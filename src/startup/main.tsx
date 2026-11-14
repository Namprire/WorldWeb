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

const host = document.createElement('div')
host.id = 'startup-city'
document.body.append(host)
createRoot(host).render(<App />)
window.__startupCity = { store: useCity, scene: null }
void useCity.getState().load()

window.addEventListener('webworld-ready', () => {
  const bridge = window.__webworldEngine
  const scene = new CityScene(bridge)
  window.__startupCity.scene = scene
  const store = useCity.getState()
  scene.onPick = (buildingId) => useCity.getState().select(buildingId)
  scene.onNear = (near) => useCity.setState({ near })
  scene.onMode = (mode) => useCity.setState({ mode })
  store.setScene(scene)

  // The title painting dives to street level; the city then opens from above.
  let opened = false
  bridge.subscribe((snapshot) => {
    if (snapshot.state === 'title') opened = false
    if (snapshot.state === 'ride' && !opened) {
      opened = true
      const params = new URLSearchParams(location.search)
      if (!params.has('street')) scene.enterExplorer(undefined, 2.6)
      // First visit opens with the narrated intro, unless motion is reduced or it was seen before.
      let seen = true
      try { seen = localStorage.getItem('startup-city-intro-seen') === '1' } catch { /* storage unavailable */ }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!seen && !reduced && !params.has('nointro') && !useCity.getState().demo.active) {
        try { localStorage.setItem('startup-city-intro-seen', '1') } catch { /* storage unavailable */ }
        setTimeout(() => useCity.getState().playCutscene({ kind: 'intro' }), 2800)
      }
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
