import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun, Sunrise, Sunset } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatClock, type Phase } from './sun'
import { useCity } from './store'

const PRESETS: { phase: Phase; label: string; today: number; summer: number }[] = [
  { phase: 'morning', label: 'Morning', today: 9 * 60 + 30, summer: 7 * 60 },
  { phase: 'afternoon', label: 'Afternoon', today: 13 * 60, summer: 14 * 60 },
  { phase: 'evening', label: 'Evening', today: 16 * 60 + 15, summer: 22 * 60 + 30 },
  { phase: 'night', label: 'Night', today: 22 * 60 + 30, summer: 1 * 60 + 30 },
]
const ICON = { morning: Sunrise, afternoon: Sun, evening: Sunset, night: Moon }

/** Helsinki time of day. Follows the real clock unless the visitor picks a time. */
export function Clock() {
  const scene = useCity((s) => s.scene)
  const time = useCity((s) => s.time)
  const { setTime, playCutscene } = useCity.getState()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState({ minutes: 720, phase: 'afternoon' as Phase, elevation: 0 })
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scene) return
    const timer = setInterval(() => setShown({ ...scene.clock }), 500)
    return () => clearInterval(timer)
  }, [scene])
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const Icon = ICON[shown.phase]
  const choose = (preset: (typeof PRESETS)[number]) => {
    setTime({ live: false, lapse: false, minutes: time.season === 'summer' ? preset.summer : preset.today })
    // Waking up to a new day starts with the news.
    if (preset.phase === 'morning') { setOpen(false); setTimeout(() => playCutscene({ kind: 'briefing' }), 400) }
  }

  return (
    <div className="sc-clock" ref={box}>
      <AnimatePresence>
        {open && (
          <motion.div className="sc-clock-panel sc-glass" role="dialog" aria-label="Time of day"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
            <h2>Time of day</h2>
            <div className="sc-segmented" role="radiogroup" aria-label="Part of the day">
              {PRESETS.map((p) => {
                const PIcon = ICON[p.phase]
                return <button key={p.phase} type="button" role="radio" aria-checked={!time.live && !time.lapse && shown.phase === p.phase} onClick={() => choose(p)}><PIcon size={15} /> {p.label}</button>
              })}
            </div>
            <label className="sc-range">
              <span className="sc-muted">Helsinki time</span>
              <input type="range" min={0} max={1439} step={5} value={Math.round(shown.minutes)} aria-label="Helsinki time"
                onChange={(event) => setTime({ live: false, lapse: false, minutes: Number(event.target.value) })} />
            </label>
            <label className="sc-check"><input type="checkbox" role="switch" checked={time.live} onChange={(event) => setTime({ live: event.target.checked, lapse: false })} /> Follow the real clock</label>
            <label className="sc-check"><input type="checkbox" role="switch" checked={time.lapse} onChange={(event) => setTime({ lapse: event.target.checked })} /> Time-lapse, one day in six minutes</label>
            <div className="sc-segmented" role="radiogroup" aria-label="Season">
              <button type="button" role="radio" aria-checked={time.season === 'today'} onClick={() => setTime({ season: 'today' })}>Today</button>
              <button type="button" role="radio" aria-checked={time.season === 'summer'} onClick={() => setTime({ season: 'summer' })}>Midsummer</button>
            </div>
            <p className="sc-muted">The sun follows its real path over Helsinki. The northern lights appear only when the sky is dark enough. A new morning opens with a news briefing.</p>
          </motion.div>
        )}
      </AnimatePresence>
      <button type="button" className="sc-clock-pill sc-glass" aria-expanded={open} onClick={() => setOpen(!open)} title="Change the time of day">
        <Icon size={16} /> {formatClock(shown.minutes)} <span className="sc-muted">{time.lapse ? 'time-lapse' : time.live ? 'now' : time.season === 'summer' ? 'midsummer' : 'set'}</span>
      </button>
    </div>
  )
}
