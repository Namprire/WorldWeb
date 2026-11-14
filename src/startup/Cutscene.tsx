import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { cutsceneSchema, type Cutscene, type CutsceneRequest } from '../shared/cutscene-schema'
import { useCity } from './store'

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms)
  signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
})

/** Reading time for a line when there is no voice. */
const readingMs = (line: string) => Math.max(3200, line.split(/\s+/).length * 380)

async function playLine(url: string | null, line: string, signal: AbortSignal, audioRef: { current: HTMLAudioElement | null }) {
  if (!url) return wait(readingMs(line), signal)
  const audio = new Audio(url)
  audioRef.current = audio
  try {
    await audio.play()
  } catch {
    // Autoplay blocked or audio missing: fall back to reading time.
    return wait(readingMs(line), signal)
  }
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    audio.addEventListener('ended', done, { once: true })
    audio.addEventListener('error', done, { once: true })
    signal.addEventListener('abort', () => { audio.pause(); done() }, { once: true })
  })
}

export function CutscenePlayer() {
  const request = useCity((s) => s.cutscene)
  const [scene, setScene] = useState<Cutscene | null>(null)
  const [index, setIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const [filmOn, setFilmOn] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    const { signal } = controller
    const store = useCity.getState()
    const city = store.scene
    if (!city) return
    const returnTo = store.mode
    const streetSpot = city.playerPosition()
    setScene(null); setIndex(-1); setError(null); setFilmOn(false)
    city.enterExplorer(undefined, 1.4)
    city.setCinematic(true)
    city.shoot('establish', null)

    const run = async () => {
      let script: Cutscene
      try {
        const response = await fetch('/api/cutscene', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request satisfies CutsceneRequest), signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'The cutscene could not be prepared.')
        script = cutsceneSchema.parse(data)
      } catch (failure) {
        if (signal.aborted) return
        setError(failure instanceof Error && failure.message ? failure.message : 'The cutscene could not be prepared.')
        await wait(2600, signal)
        return
      }
      if (signal.aborted) return
      setScene(script)
      const startups = useCity.getState().startups
      // A generated establishing film plays under the opening line, then the live city takes over.
      let filmDone: Promise<void> = Promise.resolve()
      if (script.film) {
        setFilmOn(true)
        // The film covers the screen, so the 3D city stops drawing until it ends.
        setTimeout(() => { if (!signal.aborted) city.setRendering(false) }, 900)
        filmDone = new Promise<void>((resolve) => {
          const started = performance.now()
          const check = () => {
            const video = videoRef.current
            // Done when it ends, fails, or has not started playing within 3 seconds.
            const stalled = video && video.currentTime === 0 && performance.now() - started > 3000
            if (signal.aborted || (video && (video.ended || video.error)) || stalled || performance.now() - started > 12_000) return resolve()
            setTimeout(check, 200)
          }
          setTimeout(check, 400)
        })
      }
      for (let i = 0; i < script.shots.length && !signal.aborted; i++) {
        const shot = script.shots[i]
        if (i === 1 && script.film) { await filmDone; city.setRendering(true); setFilmOn(false) }
        const target = shot.focus ? startups.find((s) => s.id === shot.focus)?.location : null
        setIndex(i)
        if (target && i === script.shots.length - 1) useCity.getState().select(target.buildingId, shot.focus, null)
        const travel = city.shoot(shot.camera, target ? { x: target.x, z: target.z } : null)
        // Hold each shot for the longer of its narration and its camera move.
        await Promise.all([playLine(shot.audio, shot.line, signal, audioRef), wait(travel * 1000 + 500, signal)])
      }
      if (!signal.aborted) await wait(600, signal)
    }

    void run().finally(() => {
      audioRef.current?.pause()
      city.setRendering(true)
      if (useCity.getState().cutscene !== request) return
      city.setCinematic(false)
      useCity.setState({ cutscene: null })
      if (returnTo === 'street') city.enterStreet(streetSpot)
    })
    return () => {
      controller.abort()
      audioRef.current?.pause()
      city.setRendering(true)
      city.setCinematic(false)
    }
  }, [request])

  useEffect(() => {
    if (!request) return
    const skip = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' && event.code !== 'Enter') return
      event.preventDefault()
      event.stopImmediatePropagation()
      useCity.setState({ cutscene: null })
    }
    window.addEventListener('keydown', skip, true)
    return () => window.removeEventListener('keydown', skip, true)
  }, [request])

  const shot = scene && index >= 0 ? scene.shots[index] : null
  return (
    <AnimatePresence>
      {request && (
        <motion.div className="sc-cutscene" role="dialog" aria-label="Cutscene" aria-live="polite"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>
          <AnimatePresence>
            {filmOn && scene?.film && (
              <motion.video key="film" ref={videoRef} className="sc-film" src={scene.film.src} poster={scene.film.poster} autoPlay muted playsInline preload="auto"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
            )}
          </AnimatePresence>
          <motion.i className="sc-bar top" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
          <motion.i className="sc-bar bottom" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
          <div className="sc-cut-top">
            <h2>{scene?.title ?? (error ? 'Cutscene unavailable' : 'Preparing the scene')}</h2>
            <span className="sc-cut-progress">
              {scene && index >= 0 && <span>{index + 1} of {scene.shots.length}</span>}
              <button type="button" onClick={() => useCity.setState({ cutscene: null })}>Skip <kbd>Esc</kbd></button>
            </span>
          </div>
          {scene && index >= 0 && <i className="sc-cut-bar" style={{ width: `${((index + 1) / scene.shots.length) * 100}%` }} />}
          <div className="sc-cut-bottom">
            <AnimatePresence mode="wait">
              <motion.p key={shot?.line ?? error ?? 'loading'} className="sc-subtitle"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                {shot?.line ?? error ?? 'Gemini is writing this scene from the company records.'}
              </motion.p>
            </AnimatePresence>
            <small>
              {scene
                ? `Written by ${scene.writer}${scene.voice ? `, voiced by ${scene.voice}` : ''}, using only the sourced records.${filmOn && scene.film ? ` Film generated by ${scene.film.model}${scene.film.faithful ? ' from a frame of the map' : ', an impression of Helsinki, not the map'}.` : ''}`
                : 'Narration is written and voiced by Gemini, using only the sourced records.'}
            </small>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
