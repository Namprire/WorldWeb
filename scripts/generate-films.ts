/**
 * Generates the establishing films used in cutscenes.
 *
 *   npm run dev                                  (in another terminal)
 *   node --import tsx scripts/generate-films.ts  [dawn|day|dusk|night ...]
 *
 * Each film starts from a frame of this app's own 3D Helsinki, captured at a real
 * time of day, which Gemini Omni Flash animates into a short painted shot. The films
 * show the city only: no company offices, interiors or people are depicted.
 */
import 'dotenv/config'
import { GoogleGenAI } from '@google/genai'
import { chromium } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MODEL = process.env.GEMINI_MODEL_VIDEO?.trim() || 'gemini-omni-1.2-flash'
const base = process.env.STARTUP_CITY_URL || 'http://127.0.0.1:5179'
const out = resolve(import.meta.dirname, '../public/films')
const manifestFile = resolve(out, 'manifest.json')

const STYLE = 'This is a stylised oil painting, not a photograph: it must stay a painting in every frame, with the same simple painted shapes. Keep the oil-paint brushwork, the colours and the exact layout of every building and street. ' +
  'Slow, steady, cinematic camera. No text, no logos, no close-up people. Quiet ambient city sound and wind, no dialogue, no music.'

const FILMS = {
  dawn: {
    minutes: 9 * 60 + 5,
    // Looking south-east from Kruununhaka over the Market Square towards the rising sun.
    camera: { tx: 520, tz: 470, dist: 600, pitch: 0.13, yaw: -2.35 },
    prompt: 'Animate this oil painting of central Helsinki at sunrise in November, exactly as painted. The camera drifts slowly forward over the rooftops towards the harbour. The low sun brightens at the horizon and warm light creeps across the tin roofs.',
  },
  day: {
    minutes: 12 * 60 + 30,
    camera: { tx: 150, tz: 250, dist: 420, pitch: 0.34, yaw: 0.6 },
    prompt: 'Animate this oil painting of central Helsinki on a clear winter afternoon. The camera glides slowly sideways above the rooftops. Clouds move across a pale blue sky, shadows shift on the ochre facades, trees sway a little, small trams and cars move along the streets.',
  },
  dusk: {
    minutes: 16 * 60 + 5,
    camera: { tx: -120, tz: 120, dist: 700, pitch: 0.18, yaw: -0.3 },
    prompt: 'Animate this oil painting of central Helsinki at dusk. The camera rises slowly. The pink and violet sky deepens to blue, windows light up one by one across the city, street lamps come on.',
  },
  night: {
    minutes: 22 * 60 + 30,
    camera: { tx: 300, tz: 400, dist: 520, pitch: 0.1, yaw: 0.05 },
    prompt: 'Animate this oil painting of Helsinki at night under the northern lights. Green aurora curtains ripple and slowly sweep across the starry sky above the lit windows. The camera tilts up slowly towards the aurora.',
  },
} as const
type FilmId = keyof typeof FILMS

const wanted = (process.argv.slice(2).filter((a) => a in FILMS) as FilmId[])
const ids = wanted.length ? wanted : (Object.keys(FILMS) as FilmId[])
const manifest: Record<string, unknown> = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {}

// 1. Capture frames of the city at each time of day, without any interface.
const browser = await chromium.launch({ headless: true, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' })
await page.goto(`${base}/?clean&nointro`)
await page.waitForFunction(() => !!(window as never as { __startupCity?: { scene: unknown } }).__startupCity?.scene, null, { timeout: 120_000 })
await page.click('#enter')
await page.waitForFunction(() => (window as never as { __webworldEngine: { getSnapshot(): { state: string } } }).__webworldEngine.getSnapshot().state === 'free', null, { timeout: 60_000 })
for (const id of ids) {
  const film = FILMS[id]
  await page.evaluate(({ minutes, camera }) => {
    const city = (window as never as { __startupCity: { store: { getState(): { setTime(t: object): void } }; scene: { flyTo(t: object, d: number): void } } }).__startupCity
    city.store.getState().setTime({ live: false, lapse: false, season: 'today', minutes })
    city.scene.flyTo(camera, 0.01)
  }, film)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: resolve(out, `${id}.jpg`), type: 'jpeg', quality: 90 })
  console.log(`captured ${id}`)
}
await browser.close()

// 2. Animate each frame with Gemini Omni Flash.
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required to generate films.')
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' })
for (const id of ids) {
  const film = FILMS[id]
  const started = Date.now()
  const prompt = `${film.prompt} ${STYLE}`
  try {
    const interaction = await ai.interactions.create({
      model: MODEL,
      input: [
        { type: 'image', mime_type: 'image/jpeg', data: readFileSync(resolve(out, `${id}.jpg`)).toString('base64') },
        { type: 'text', text: prompt },
      ],
      response_format: { type: 'video', duration: '8s', aspect_ratio: '16:9', resolution: '720p' },
    } as never, { timeout: 600_000, maxRetries: 0 })
    type Block = { type: string; data?: string; mime_type?: string; uri?: string }
    const result = interaction as { steps?: { content?: Block[] }[]; output_video?: Block }
    const video = result.output_video ?? (result.steps ?? []).flatMap((s) => s.content ?? []).find((b) => b.type === 'video')
    if (!video?.data) throw new Error(`no video data (${JSON.stringify(video ?? {}).slice(0, 200)})`)
    writeFileSync(resolve(out, `${id}.mp4`), Buffer.from(video.data, 'base64'))
    manifest[id] = { src: `/films/${id}.mp4`, poster: `/films/${id}.jpg`, model: MODEL, prompt, seconds: 8, generatedAt: new Date().toISOString(), from: 'Frame of this app\'s 3D Helsinki' }
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 1))
    console.log(`${id}: ${((Date.now() - started) / 1000).toFixed(0)} s`)
  } catch (error) {
    console.log(`${id} failed: ${String((error as Error).message).slice(0, 300)}`)
  }
}
