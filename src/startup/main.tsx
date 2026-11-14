import '../webworld/local-services'
import '../webworld/webworld.css'
import '../webworld/oil-paint.css'
import '@fontsource-variable/google-sans-flex'
import './startup.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { CityScene, type Bridge } from './scene'
import { useCity } from './store'

declare global {
  interface Window {
    __webworldEngine: Bridge
    /** Test and debugging handle. */
    __startupCity: { store: typeof useCity; scene: CityScene | null }
  }
}

// ?clean renders the city alone, for capturing frames that films are generated from.
if (new URLSearchParams(location.search).has('clean')) document.body.classList.add('sc-clean')

const host = document.createElement('div')
host.id = 'startup-city'
document.body.append(host)
createRoot(host).render(<App />)
document.body.classList.toggle('sc-no-labels', !useCity.getState().labels)
window.__startupCity = { store: useCity, scene: null }
void useCity.getState().load()

/** ?company=<id> opens that company's profile once the city is in view, so profiles can be shared. */
function openDeepLink() {
  const id = new URLSearchParams(location.search).get('company')
  if (!id) return
  const state = useCity.getState()
  const startup = state.startups.find((s) => s.id === id)
  if (!startup) return
  state.select(startup.location?.buildingId ?? null, startup.id, startup.location ? 'map' : null)
  if (startup.location) state.scene?.focusBuilding(startup.location.buildingId)
}

// Keep the address bar in step with the open profile, so copying the URL shares it.
useCity.subscribe((state, previous) => {
  if (state.selectedId === previous.selectedId) return
  const url = new URL(location.href)
  if (state.selectedId) url.searchParams.set('company', state.selectedId)
  else url.searchParams.delete('company')
  history.replaceState(null, '', url)
})

window.addEventListener('webworld-ready', () => {
  const bridge = window.__webworldEngine
  const scene = new CityScene(bridge)
  window.__startupCity.scene = scene
  const store = useCity.getState()
  scene.onPick = (buildingId) => useCity.getState().select(buildingId)
  scene.onNear = (near) => useCity.setState({ near })
  scene.onMode = (mode) => useCity.setState({ mode })
  scene.timeSettings = () => useCity.getState().time
  scene.setGraphics(useCity.getState().graphics)
  scene.onTier = (tier) => useCity.getState().notify(`Switched to ${tier} graphics to keep things smooth`)
  // A morning that arrives while exploring (real clock or time-lapse) opens with the news, once per day.
  let lastBriefing = -1
  scene.onPhase = (phase, previous) => {
    const state = useCity.getState()
    const day = Math.floor(Date.now() / 86_400_000) + (state.time.lapse ? Math.floor(performance.now() / 360_000) : 0)
    if (phase === 'morning' && previous === 'night' && day !== lastBriefing && !state.cutscene && !state.demo.active) {
      lastBriefing = day
      state.playCutscene({ kind: 'briefing' })
    }
  }
  store.setScene(scene)

  // The title painting dives to street level; the city then opens from above.
  let opened = false
  bridge.subscribe((snapshot) => {
    if (snapshot.state === 'title') opened = false
    if (snapshot.state === 'ride' && !opened) {
      opened = true
      const params = new URLSearchParams(location.search)
      if (params.has('street')) return
      // First visit: the narrated intro follows the opening flight, unless motion is reduced or it was seen before.
      let seen = true
      try { seen = localStorage.getItem('startup-city-intro-seen') === '1' } catch { /* storage unavailable */ }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scene.openingFlight(() => {
        openDeepLink()
        if (!seen && !reduced && !params.has('nointro') && !useCity.getState().demo.active) {
          try { localStorage.setItem('startup-city-intro-seen', '1') } catch { /* storage unavailable */ }
          setTimeout(() => useCity.getState().playCutscene({ kind: 'intro' }), 600)
        }
      })
    }
    if (useCity.getState().entered !== scene.entered) useCity.setState({ entered: scene.entered })
  })
})

const fatal = (message: string) => {
  const box = document.getElementById('fatal')
  if (!box) return
  box.textContent = message
  box.classList.remove('hidden')
}
const gameScript = document.createElement('script')
gameScript.type = 'module'
gameScript.src = '/engine/game.js'
gameScript.addEventListener('error', () => fatal('STARTUP CITY could not load the 3D engine. Reload to try again.'))
document.head.append(gameScript)
