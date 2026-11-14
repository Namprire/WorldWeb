import express, { type Express } from 'express'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  databaseSchema, parseQueryLocally, suggestionSchema, type NewsItem, type Startup, type Suggestion,
} from '../../src/shared/startup-schema'
import { settings } from '../config'
import { createContext, refreshSignals } from './context'
import { createGemini } from './gemini'
import { createCutscenes } from './cutscenes'
import { cutsceneRequestSchema } from '../../src/shared/cutscene-schema'
import { MISSIONS } from '../../src/startup/logic'

/**
 * STARTUP CITY API. API keys stay on the server; the browser only sees sourced records.
 *
 *  GET  /api/startups             stored records (the cached snapshot until a refresh succeeds)
 *  POST /api/signals/refresh      re-read news and careers pages through Context.dev
 *  POST /api/search               question -> structured filters (Gemini, with a keyword fallback)
 *  POST /api/ask                  question about one company, answered only from its record
 *  POST /api/connections/suggest  AI-inferred relationship suggestions
 *  GET|POST /api/monitors         Context.dev page monitors for selected companies
 */

const root = resolve(import.meta.dirname, '../..')
const dataFile = resolve(root, 'data/startups.json')
const suggestionsFile = resolve(root, 'data/suggestions.json')
const monitorsFile = resolve(root, 'data/monitors.json')

const REFRESH_BATCH = 6
const REFRESH_TTL_MS = 10 * 60_000
const SINGLE_TTL_MS = 60_000

function readJson<T>(file: string, fallback: T): T {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as T : fallback
  } catch {
    return fallback
  }
}
function writeJson(file: string, value: unknown) {
  const temporary = `${file}.tmp`
  writeFileSync(temporary, JSON.stringify(value, null, 1))
  renameSync(temporary, file)
}

export function registerStartupRoutes(app: Express) {
  const database = databaseSchema.parse(readJson(dataFile, { meta: { generatedAt: new Date(0).toISOString(), note: 'No snapshot found.' }, startups: [] }))
  const byId = new Map(database.startups.map((s) => [s.id, s]))
  const context = settings.contextKey ? createContext(settings.contextKey) : undefined
  const gemini = settings.geminiKey ? createGemini(settings.geminiKey, settings.geminiModels) : undefined
  const cutscenes = createCutscenes(settings.geminiKey, { writer: settings.geminiModels.research, voice: settings.geminiModels.voice })
  const missionTitles = Object.fromEntries(MISSIONS.map((m) => [m.id, m.title]))
  const refreshedAt = new Map<string, number>()
  let suggestions = readJson<{ generatedAt: string | null; model: string | null; items: Suggestion[] }>(suggestionsFile, { generatedAt: null, model: null, items: [] })
  const monitors = readJson<Record<string, { monitorId: string; url: string; createdAt: string }>>(monitorsFile, {})
  let refreshing: Promise<unknown> | undefined
  let lastLiveAt: string | null = null

  const sameOrigin: express.RequestHandler = (request, response, next) => {
    if (request.get('sec-fetch-site') === 'cross-site') {
      response.status(403).json({ error: 'Open STARTUP CITY to use this service.' })
      return
    }
    next()
  }
  const json = express.json({ limit: '8kb' })
  // Calls that spend Gemini or Context.dev credits are limited per visitor, so a public link cannot run up a bill.
  const hits = new Map<string, number[]>()
  const limit = (max: number, windowMs: number): express.RequestHandler => (request, response, next) => {
    const key = `${request.path}|${request.ip}`
    const now = Date.now()
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      response.status(429).json({ error: 'Too many requests for now. Try again in a few minutes.' })
      return
    }
    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
    next()
  }
  const TEN_MINUTES = 10 * 60_000
  const persist = () => {
    database.startups = database.startups.map((s) => byId.get(s.id) ?? s)
    writeJson(dataFile, database)
  }

  app.get('/api/startups', (_request, response) => {
    response.json({
      startups: [...byId.values()],
      suggestions,
      meta: {
        snapshotAt: database.meta.generatedAt,
        note: database.meta.note,
        lastLiveAt,
        contextAvailable: Boolean(context),
        geminiAvailable: Boolean(gemini),
        models: gemini?.models ?? null,
        cutscenes: { writer: cutscenes.available ? settings.geminiModels.research : null, voice: cutscenes.available ? settings.geminiModels.voice : null },
        monitored: Object.keys(monitors),
      },
    })
  })

  app.post('/api/signals/refresh', sameOrigin, limit(6, TEN_MINUTES), json, async (request, response) => {
    const body = z.object({ ids: z.array(z.string()).max(40).optional(), force: z.boolean().optional() }).safeParse(request.body ?? {})
    if (!body.success) { response.status(400).json({ error: 'Invalid refresh request.' }); return }
    if (!context) {
      response.status(503).json({ mode: 'cached', error: 'Context.dev is not configured on the server. Showing the cached snapshot.' })
      return
    }
    if (refreshing) await refreshing.catch(() => undefined)

    const now = Date.now()
    const candidates = (body.data.ids?.length ? body.data.ids.map((id) => byId.get(id)).filter((s): s is Startup => Boolean(s)) : [...byId.values()])
      .filter((s) => s.industry !== 'hub')
    // A deliberate single-company re-read may repeat sooner than a city-wide sweep.
    const ttl = body.data.ids?.length === 1 ? SINGLE_TTL_MS : REFRESH_TTL_MS
    const fresh = candidates.filter((s) => now - (refreshedAt.get(s.id) ?? 0) < ttl)
    // Oldest readings first; a request never reads more than a small batch.
    const due = candidates.filter((s) => !fresh.includes(s))
      .sort((a, b) => Date.parse(a.newsCheckedAt ?? '1970') - Date.parse(b.newsCheckedAt ?? '1970'))
      .slice(0, REFRESH_BATCH)
    const names = [...byId.values()].map(({ id, name }) => ({ id, name }))
    const before = context.usage.credits

    const work = Promise.all(due.map(async (startup) => {
      try {
        const { startup: next, errors } = await refreshSignals(context, startup, names)
        const known = new Set(startup.news.map((n) => n.url))
        const newNews: NewsItem[] = next.news.filter((n) => !known.has(n.url))
        const jobsBefore = startup.jobs?.value.length ?? 0, jobsAfter = next.jobs?.value.length ?? 0
        if (errors.length < 2) {
          byId.set(next.id, next)
          refreshedAt.set(next.id, Date.now())
        }
        return { id: startup.id, name: startup.name, status: errors.length === 2 ? 'failed' as const : errors.length ? 'partial' as const : 'updated' as const, errors, newNews, jobsBefore, jobsAfter }
      } catch {
        return { id: startup.id, name: startup.name, status: 'failed' as const, errors: ['news', 'jobs'], newNews: [], jobsBefore: 0, jobsAfter: 0 }
      }
    }))
    refreshing = work
    const results = await work
    refreshing = undefined
    const succeeded = results.filter((r) => r.status !== 'failed')
    if (succeeded.length) {
      lastLiveAt = new Date().toISOString()
      persist()
    }
    if (due.length && !succeeded.length) {
      response.status(502).json({ mode: 'cached', error: 'Context.dev could not be reached. Showing the cached snapshot.', results })
      return
    }
    console.info(`[Startup City] refreshed ${succeeded.length}/${due.length}, ${context.usage.credits - before} Context.dev credits`)
    response.json({
      mode: 'live',
      retrievedAt: lastLiveAt,
      results,
      skippedFresh: fresh.map((s) => s.id),
      remaining: Math.max(0, candidates.length - fresh.length - due.length),
      startups: results.filter((r) => r.status !== 'failed').map((r) => byId.get(r.id)!),
    })
  })

  app.post('/api/search', sameOrigin, limit(40, TEN_MINUTES), json, async (request, response) => {
    const body = z.object({ query: z.string().trim().min(1).max(240) }).safeParse(request.body)
    if (!body.success) { response.status(400).json({ error: 'Ask a question of up to 240 characters.' }); return }
    const local = parseQueryLocally(body.data.query)
    if (!gemini) { response.json({ mode: 'local', filters: local, model: null }); return }
    try {
      response.json({ mode: 'gemini', filters: await gemini.interpret(body.data.query), model: gemini.models.fast })
    } catch (error) {
      console.warn(`[Startup City] Gemini search fallback: ${String((error as Error).message).slice(0, 120)}`)
      response.json({ mode: 'local', filters: local, model: null })
    }
  })

  app.post('/api/ask', sameOrigin, limit(30, TEN_MINUTES), json, async (request, response) => {
    const body = z.object({ id: z.string(), question: z.string().trim().min(1).max(300), deep: z.boolean().optional() }).safeParse(request.body)
    const startup = body.success ? byId.get(body.data.id) : undefined
    if (!body.success || !startup) { response.status(400).json({ error: 'Unknown company or empty question.' }); return }
    if (!gemini) { response.status(503).json({ error: 'Gemini is not configured on the server.' }); return }
    try {
      response.json({ ...(await gemini.ask(startup, body.data.question, Boolean(body.data.deep))), generatedAt: new Date().toISOString() })
    } catch (error) {
      console.warn(`[Startup City] Gemini ask failed: ${String((error as Error).message).slice(0, 120)}`)
      response.status(502).json({ error: 'Gemini could not answer right now. The verified profile above is unaffected.' })
    }
  })

  app.post('/api/connections/suggest', sameOrigin, limit(3, TEN_MINUTES), async (_request, response) => {
    if (!gemini) { response.status(503).json({ error: 'Gemini is not configured on the server.', suggestions }); return }
    try {
      const items = z.array(suggestionSchema).parse(await gemini.suggest([...byId.values()]))
      suggestions = { generatedAt: new Date().toISOString(), model: gemini.models.deep, items }
      writeJson(suggestionsFile, suggestions)
      response.json({ suggestions })
    } catch (error) {
      console.warn(`[Startup City] Gemini suggestions failed: ${String((error as Error).message).slice(0, 120)}`)
      response.status(502).json({ error: 'Gemini could not suggest connections right now.', suggestions })
    }
  })

  app.post('/api/cutscene', sameOrigin, limit(20, TEN_MINUTES), json, async (request, response) => {
    const body = cutsceneRequestSchema.safeParse(request.body)
    if (!body.success) { response.status(400).json({ error: 'Invalid cutscene request.' }); return }
    try {
      const scene = await cutscenes.get(body.data, [...byId.values()], missionTitles)
      if (!scene) { response.status(404).json({ error: 'There is nothing on the map to show for this.' }); return }
      response.json(scene)
    } catch (error) {
      console.warn(`[Startup City] cutscene failed: ${String((error as Error).message).slice(0, 160)}`)
      response.status(502).json({ error: 'The cutscene could not be prepared.' })
    }
  })

  app.get('/api/cutscene/audio/:file', (request, response) => {
    const file = request.params.file
    if (!/^[a-f0-9]{20}-\d\.mp3$/.test(file)) { response.status(404).end(); return }
    response.set('Cache-Control', 'public, max-age=31536000, immutable')
    response.sendFile(resolve(cutscenes.directory, file), (error) => { if (error && !response.headersSent) response.status(404).end() })
  })

  // Prepare the opening scene in the background so the first visit does not wait for it.
  if (cutscenes.available) {
    // Prepare the scenes that can start without a click (intro and morning briefing), so they never keep anyone waiting.
    void cutscenes.get({ kind: 'intro' }, [...byId.values()], missionTitles)
      .then(() => cutscenes.get({ kind: 'briefing' }, [...byId.values()], missionTitles))
      .catch(() => undefined)
  }

  app.get('/api/monitors', (_request, response) => {
    response.json({ monitors })
  })

  app.post('/api/monitors', sameOrigin, limit(5, TEN_MINUTES), json, async (request, response) => {
    const body = z.object({ id: z.string() }).safeParse(request.body)
    const startup = body.success ? byId.get(body.data.id) : undefined
    if (!startup) { response.status(400).json({ error: 'Unknown company.' }); return }
    if (monitors[startup.id]) { response.json({ monitor: monitors[startup.id], existing: true }); return }
    if (!context) { response.status(503).json({ error: 'Context.dev is not configured on the server.' }); return }
    const url = startup.careersUrl ?? startup.website
    if (!url) { response.status(400).json({ error: 'This company has no website to monitor.' }); return }
    try {
      const monitor = await context.watch(startup.name, url)
      monitors[startup.id] = { monitorId: monitor.id, url, createdAt: new Date().toISOString() }
      writeJson(monitorsFile, monitors)
      response.json({ monitor: monitors[startup.id], existing: false })
    } catch (error) {
      const status = (error as { status?: number }).status
      console.warn(`[Startup City] monitor failed: ${String((error as Error).message).slice(0, 160)}`)
      response.status(502).json({ error: status === 402 || status === 403 ? 'This Context.dev plan cannot create more monitors.' : 'Context.dev could not start monitoring this page.' })
    }
  })
}
