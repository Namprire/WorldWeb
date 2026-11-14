/**
 * STARTUP CITY scene layer.
 *
 * Runs inside the existing oil-paint Helsinki renderer (one canvas, one frame loop). It adds:
 *  - the bird's-eye City Explorer camera and the transition to and from street level
 *  - glowing shells and light beams on startup buildings
 *  - projected HTML markers, connection arcs and navigation routes
 *  - building picking and a walkable road graph
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { atHelsinkiTime, helsinkiMinutes, phaseOf, sunPosition, type Phase } from './sun'
type Engine = any
type Building = { id: string; name: string; rings: number[][][]; triangles: number[][]; h: number; bounds: number[]; parent?: string }
type Road = { kind: string; points: number[][] }

export type Bridge = {
  engine: Engine
  visuals: { setSun(x: number, y: number, z: number, elevation: number): void; getLight(): { day: number; dusk: number; dark: number } }
  district: {
    setDrawScale(scale: number, focus?: { x: number; z: number } | null, treeRadius?: number): void
    setMinimapOverlay(overlay: { buildings?: string[]; routes?: { points: number[][]; color: string }[] }): void
  }
  geography: {
    mapData: { buildings: Building[]; parts: Building[]; roads: Road[]; bounds: { west: number; east: number; north: number; south: number } }
    districtProbe(x: number, z: number, y: number, radius?: number): { blocked: boolean }
    inPolygon(x: number, z: number, rings: number[][][]): boolean
  }
  getSnapshot(): { state: string; gx: number; gz: number; heading: number; speed: number; walking: boolean }
  subscribe(callback: (snapshot: any) => void): () => void
  onFrame(callback: (dt: number, time: number) => void): () => void
}

export type MarkerInput = {
  buildingId: string
  x: number
  z: number
  title: string
  subtitle: string
  color: string
  logos: { src: string | null; initials: string; dark?: boolean }[]
  count: number
  hiring: boolean
  funded: boolean
  news: boolean
  launch: boolean
  /** flash: a building whose company just had news; it pulses briefly. */
  state: 'normal' | 'match' | 'dim' | 'selected' | 'flash'
  /** Junction 2026 partner in this building, shown with its official logo. */
  partner?: { name: string; tier: string; logo: string | null } | null
}

export type Link = { a: string; b: string; color: string; dashed: boolean; width: number }
export type Mode = 'explorer' | 'street'
export type Graphics = 'auto' | 'smooth' | 'balanced' | 'detailed'
type Tier = Exclude<Graphics, 'auto'>
/** What each graphics level costs: resolution range, extra draw and fog distance from above, tree radius. */
const TIERS: Record<Tier, { maxQ: number; minQ: number; draw: number; fogNear: number; fogFar: number; trees: number }> = {
  smooth: { maxQ: 0.6, minQ: 0.4, draw: 3, fogNear: 500, fogFar: 1700, trees: 0 },
  balanced: { maxQ: 0.8, minQ: 0.5, draw: 5.5, fogNear: 900, fogFar: 3200, trees: 320 },
  detailed: { maxQ: 1, minQ: 0.6, draw: 9, fogNear: 1500, fogFar: 5200, trees: 520 },
}
export type TimeSettings = { live: boolean; minutes: number; season: 'today' | 'summer'; lapse: boolean }
type Glow = { color: [number, number, number]; power: number; pulse: number }

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  // Scene colours are linear; convert from the sRGB interface palette.
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2)) as [number, number, number]
}

const EXPLORER_FOV = 58
const HOME = { tx: -300, tz: 90, dist: 1180, yaw: 0.18, pitch: 0.38 }

export class CityScene {
  mode: Mode = 'street'
  /** True once the visitor has entered the city from the title painting. */
  entered = false
  onPick: (buildingId: string | null, name: string | null) => void = () => {}
  onNear: (buildingId: string | null) => void = () => {}
  onMode: (mode: Mode) => void = () => {}
  onPhase: (phase: Phase, previous: Phase | null) => void = () => {}
  onTier: (tier: Tier) => void = () => {}
  /** Read every frame; the store owns the visitor's time settings. */
  timeSettings: () => TimeSettings = () => ({ live: true, minutes: 720, season: 'today', lapse: false })
  /** Current Helsinki clock in minutes, and the sun, as shown. */
  clock = { minutes: 720, elevation: 0, phase: 'afternoon' as Phase }
  private lapseMinutes: number | null = null
  private lastSunUpdate = -1

  private e: Engine
  private map: Bridge['geography']['mapData']
  private buildings = new Map<string, Building>()
  private grid = new Map<string, Building[]>()
  private cam = { ...HOME }
  private goal = { ...HOME }
  private blend: { from: number[]; fromLook: number[]; to?: number[]; toLook?: number[]; t: number; duration: number; hold?: number; done?: () => void } | null = null
  private fly: { from: typeof HOME; to: typeof HOME; t: number; duration: number } | null = null
  private keys = new Set<string>()
  private glowGroup: any
  private glows = new Map<string, { mesh: any; uniforms: any; target: Glow; current: Glow; top: number; x: number; z: number }>()
  private markerLayer: HTMLDivElement
  private markers = new Map<string, { el: HTMLButtonElement; input: MarkerInput; top: number }>()
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private links: Link[] = []
  private routes: { points: number[][]; color: string }[] = []
  private near: string | null = null
  private graph: { nodes: number[][]; edges: Map<number, [number, number][]>; cells: Map<string, number[]> } | null = null
  private vec: any
  private input: HTMLDivElement
  private hover: string | null = null
  private streetFog = [240, 850]
  cinematic = false
  private drift = { yaw: 0, dist: 0, pitch: 0 }
  private visited = false

  constructor(private bridge: Bridge) {
    this.e = bridge.engine
    this.map = bridge.geography.mapData
    this.vec = new this.e.Vector()
    for (const b of this.map.buildings) {
      this.buildings.set(b.id, b)
      for (let i = Math.floor(b.bounds[0] / 60); i <= Math.floor(b.bounds[2] / 60); i++)
        for (let j = Math.floor(b.bounds[1] / 60); j <= Math.floor(b.bounds[3] / 60); j++) {
          const key = `${i},${j}`
          if (!this.grid.has(key)) this.grid.set(key, [])
          this.grid.get(key)!.push(b)
        }
    }
    // Landmark parts can stand taller than their parent outline.
    for (const part of this.map.parts) {
      const parent = part.parent && this.buildings.get(part.parent)
      if (parent) parent.h = Math.max(parent.h, part.h)
    }

    this.glowGroup = new this.e.Group()
    this.glowGroup.name = 'STARTUP CITY glow'
    this.e.scene.add(this.glowGroup)
    this.addApron()

    this.input = document.createElement('div')
    this.input.id = 'sc-input'
    this.overlay = document.createElement('canvas')
    this.overlay.id = 'sc-overlay'
    this.ctx = this.overlay.getContext('2d')!
    this.markerLayer = document.createElement('div')
    this.markerLayer.id = 'sc-markers'
    document.body.append(this.input, this.overlay, this.markerLayer)
    this.bindInput()
    bridge.onFrame((dt, time) => this.frame(dt, time))
    // Start at the level's resolution rather than the engine's full default.
    this.e.state.quality = TIERS[this.tier].maxQ
    window.dispatchEvent(new Event('resize'))
  }

  // Camera

  private orbitPose(c = this.cam) {
    const horizontal = c.dist * Math.cos(c.pitch)
    return {
      pos: [c.tx + Math.sin(c.yaw) * horizontal, c.dist * Math.sin(c.pitch), c.tz + Math.cos(c.yaw) * horizontal],
      look: [c.tx, 0, c.tz],
    }
  }

  private clampGoal() {
    const B = this.map.bounds
    this.goal.tx = clamp(this.goal.tx, B.west, B.east)
    this.goal.tz = clamp(this.goal.tz, B.north, B.south)
    this.goal.dist = clamp(this.goal.dist, 60, 2600)
    this.goal.pitch = clamp(this.goal.pitch, 0.2, 1.48)
  }

  /** Rise from wherever the camera is into the bird's-eye view. */
  enterExplorer(focus?: Partial<typeof HOME>, duration = 2.2) {
    const e = this.e
    if (this.mode === 'explorer' && e.state.state === 'free') {
      if (focus) this.flyTo(focus)
      return
    }
    const camera = e.camera
    const forward = new e.Vector(0, 0, -1).applyQuaternion(camera.quaternion)
    const from = [camera.position.x, camera.position.y, camera.position.z]
    const player = e.player
    // The first rise opens on the whole district; later ones stay over the rider.
    const start = this.visited
      ? { ...HOME, tx: clamp(player.gx, this.map.bounds.west, this.map.bounds.east), tz: clamp(player.gz, this.map.bounds.north, this.map.bounds.south), dist: 620, pitch: 0.5, ...focus }
      : { ...HOME, ...focus }
    this.visited = true
    this.cam = { ...start }
    this.goal = { ...start }
    this.clampGoal()
    this.blend = { from, fromLook: [from[0] + forward.x * 60, from[1] + forward.y * 60, from[2] + forward.z * 60], t: 0, duration: this.reduced() ? 0.01 : duration }
    e.state.free = { x: from[0], y: from[1], z: from[2], yaw: 0, pitch: 0, fov: EXPLORER_FOV, bend: 0 }
    e.state.state = 'free'
    e.player.speed = 0
    e.input?.clear?.()
    this.setMode('explorer')
  }

  /**
   * The opening shot: high above the city looking north into the northern lights, a pause, then a
   * slow tilt down and descent onto the district. Any click or key skips to the end.
   */
  openingFlight(done?: () => void) {
    const e = this.e
    this.visited = true
    this.cam = { ...HOME }
    this.goal = { ...HOME }
    // Start high over the harbour with the northern lights above the whole city, then glide down.
    const keys = [
      { at: 0, pos: [HOME.tx + 40, 900, HOME.tz + 2300], look: [HOME.tx, 420, HOME.tz - 3800] },
    ]
    document.body.classList.add('sc-opening')
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      document.body.classList.remove('sc-opening')
      window.removeEventListener('pointerdown', skip, true)
      window.removeEventListener('keydown', skip, true)
      done?.()
    }
    const skip = () => { if (this.opening) this.opening.t = Math.max(this.opening.t, 0.97) }
    window.addEventListener('pointerdown', skip, true)
    window.addEventListener('keydown', skip, true)
    this.opening = { t: this.reduced() ? 1 : 0, duration: 6.5, keys, done: finish }
    e.state.free = { x: keys[0].pos[0], y: keys[0].pos[1], z: keys[0].pos[2], yaw: 0, pitch: 0, fov: EXPLORER_FOV, bend: 0 }
    e.state.state = 'free'
    e.player.speed = 0
    e.input?.clear?.()
    this.setMode('explorer')
  }

  private opening: { t: number; duration: number; keys: { at: number; pos: number[]; look: number[] }[]; done: () => void } | null = null

  /** Camera pose during the opening, eased between keyframes and ending on the city view. */
  private openingPose(dt: number) {
    const o = this.opening!
    o.t = Math.min(1, o.t + dt / o.duration)
    const end = this.orbitPose()
    const keys = [...o.keys, { at: 1, pos: end.pos, look: end.look }]
    let k = 0
    while (k < keys.length - 2 && o.t > keys[k + 1].at) k++
    const a = keys[k], b = keys[k + 1]
    const t = ease(clamp((o.t - a.at) / Math.max(1e-6, b.at - a.at), 0, 1))
    const pose = { pos: a.pos.map((v, i) => v + (b.pos[i] - v) * t), look: a.look.map((v, i) => v + (b.look[i] - v) * t) }
    if (o.t >= 1) { this.opening = null; o.done() }
    return { pose, progress: o.t }
  }

  skipOpening() { if (this.opening) this.opening.t = Math.max(this.opening.t, 0.97) }

  /** Skip the engine's painting-frame dive; the opening flight replaces it. */
  skipDive = true

  /** Drop to street level beside a map position and hand control back to the rider. */
  enterStreet(near?: { x: number; z: number }) {
    const e = this.e
    if (this.mode === 'street' || this.blend?.to) return
    // Dropping to the street may interrupt the rise into the city view.
    this.blend = null
    const spot = this.clearSpot(near ?? { x: this.cam.tx, z: this.cam.tz })
    const player = e.player
    player.gx = spot.x
    player.gz = spot.z
    player.y = 0
    player.vy = 0
    player.speed = 0
    player.grounded = true
    player.wings = player.flying = false
    if (near) player.heading = Math.atan2(near.z - spot.z, near.x - spot.x)
    player.syncWorld()
    e.chase.snap(player)
    const camera = e.camera
    this.blend = {
      from: [camera.position.x, camera.position.y, camera.position.z],
      fromLook: [this.cam.tx, 0, this.cam.tz],
      to: [e.chase.pos.x, e.chase.pos.y, e.chase.pos.z],
      toLook: [e.chase.target.x, e.chase.target.y, e.chase.target.z],
      t: 0,
      duration: this.reduced() ? 0.01 : 1.9,
      done: () => {
        e.state.rideT = 1
        e.state.state = 'ride'
      },
    }
    this.setMode('street')
  }

  private setMode(mode: Mode) {
    this.mode = mode
    document.body.dataset.scMode = mode
    this.keys.clear()
    this.onMode(mode)
  }

  flyTo(target: Partial<typeof HOME>, duration = 1.6) {
    if (this.mode !== 'explorer') return
    const to = { ...this.goal, ...target }
    // Turn the short way round.
    to.yaw = this.cam.yaw + Math.atan2(Math.sin(to.yaw - this.cam.yaw), Math.cos(to.yaw - this.cam.yaw))
    this.fly = { from: { ...this.cam }, to, t: 0, duration: this.reduced() ? 0.01 : duration }
    this.goal = { ...to }
    this.clampGoal()
  }

  /** Start or stop cutscene control of the camera. */
  setCinematic(on: boolean) {
    this.cinematic = on
    this.drift = { yaw: 0, dist: 0, pitch: 0 }
    this.keys.clear()
    document.body.classList.toggle('sc-cinema', on)
  }

  /** One scripted camera move. Returns how long the travel part takes, in seconds. */
  shoot(move: 'establish' | 'aurora' | 'flyover' | 'orbit' | 'close' | 'rise', focus: { x: number; z: number } | null) {
    const at = focus ?? { x: this.cam.tx, z: this.cam.tz }
    const yaw = this.cam.yaw
    const plans = {
      establish: { to: { tx: HOME.tx, tz: HOME.tz, dist: 1500, pitch: 0.3, yaw: yaw + 0.25 }, travel: 3.2, drift: { yaw: 0.025, dist: -0.02, pitch: 0 } },
      aurora: { to: { tx: at.x, tz: at.z + 300, dist: 520, pitch: 0.1, yaw: 0.05 }, travel: 3.4, drift: { yaw: 0.015, dist: 0, pitch: 0.004 } },
      flyover: { to: { tx: at.x, tz: at.z, dist: 360, pitch: 0.55, yaw: yaw + 0.5 }, travel: 3.6, drift: { yaw: 0.05, dist: -0.015, pitch: 0 } },
      orbit: { to: { tx: at.x, tz: at.z, dist: 250, pitch: 0.42, yaw: yaw + 0.8 }, travel: 2.8, drift: { yaw: 0.14, dist: 0, pitch: 0 } },
      close: { to: { tx: at.x, tz: at.z, dist: 120, pitch: 0.2, yaw: yaw + 0.4 }, travel: 2.6, drift: { yaw: 0.06, dist: -0.01, pitch: 0.004 } },
      rise: { to: { tx: at.x, tz: at.z, dist: 1700, pitch: 1.05, yaw: yaw + 0.3 }, travel: 5, drift: { yaw: 0.02, dist: 0.01, pitch: 0 } },
    }[move]
    this.flyTo(plans.to, plans.travel)
    this.drift = plans.drift
    return this.reduced() ? 0 : plans.travel
  }

  flyHome() {
    this.flyTo(HOME, 1.8)
  }

  /** Frame a set of map points. */
  frameBounds(points: { x: number; z: number }[]) {
    if (!points.length) return this.flyHome()
    const xs = points.map((p) => p.x), zs = points.map((p) => p.z)
    const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...zs) - Math.min(...zs)) * 1.5, 260)
    this.flyTo({ tx: (Math.max(...xs) + Math.min(...xs)) / 2, tz: (Math.max(...zs) + Math.min(...zs)) / 2 + span * 0.08, dist: clamp(span * 1.05, 420, 2300), pitch: 0.62 })
  }

  focusBuilding(buildingId: string, dist = 300) {
    const glow = this.glows.get(buildingId)
    if (!glow) return
    this.flyTo({ tx: glow.x, tz: glow.z, dist, pitch: 0.52, yaw: this.cam.yaw + 0.35 })
  }

  private reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  /** The point on the ground (y = 0) under a screen position, using the camera as last rendered. */
  private groundAt(clientX: number, clientY: number) {
    const camera = this.e.camera
    const far = this.vec.set((clientX / window.innerWidth) * 2 - 1, 1 - (clientY / window.innerHeight) * 2, 0.5).unproject(camera)
    const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z
    const dx = far.x - ox, dy = far.y - oy, dz = far.z - oz
    if (dy >= -1e-4) return null
    const t = -oy / dy
    // Points near the horizon are too far away to be useful anchors.
    if (t * Math.hypot(dx, dy, dz) > 12000) return null
    return { x: ox + dx * t, z: oz + dz * t }
  }

  private inertia = { vx: 0, vz: 0 }

  /** Zoom by a factor while keeping the ground point under the cursor fixed, like a web map. */
  zoomAt(factor: number, clientX = window.innerWidth / 2, clientY = window.innerHeight / 2, animate = false) {
    if (this.mode !== 'explorer' || this.cinematic) return
    const dist = clamp(this.goal.dist * factor, 60, 2600)
    const f = dist / this.goal.dist
    const anchor = this.groundAt(clientX, clientY) ?? { x: this.goal.tx, z: this.goal.tz }
    const target = { tx: anchor.x + (this.goal.tx - anchor.x) * f, tz: anchor.z + (this.goal.tz - anchor.z) * f, dist }
    if (animate) this.flyTo(target, 0.45)
    else {
      this.fly = null
      Object.assign(this.goal, target)
      this.clampGoal()
    }
  }

  /** Pause 3D rendering, for example while a full-screen film covers the view. The frame loop keeps running. */
  setRendering(on: boolean) {
    this.e.state.blind = !on
  }

  /** Map heading in radians, for the compass. */
  heading() { return this.cam.yaw }

  /** Face north and look down at the default tilt. */
  resetNorth() {
    this.flyTo({ yaw: 0, pitch: HOME.pitch }, 0.6)
  }

  private bindInput() {
    const el = this.input
    const pointers = new Map<number, { x: number; y: number }>()
    let drag: { x: number; y: number; moved: number; rotate: boolean; samples: { t: number; x: number; z: number }[] } | null = null
    let pinch: { distance: number; angle: number; midY: number } | null = null
    let hoverQueued = false, hoverX = 0, hoverY = 0
    el.addEventListener('contextmenu', (event) => event.preventDefault())
    el.addEventListener('pointerdown', (event) => {
      if (this.cinematic) return
      el.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      this.fly = null
      this.inertia = { vx: 0, vz: 0 }
      if (pointers.size === 1) drag = { x: event.clientX, y: event.clientY, moved: 0, rotate: event.button === 2 || event.shiftKey || event.ctrlKey, samples: [] }
      else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), midY: (a.y + b.y) / 2 }
        drag = null
      }
    })
    el.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) {
        // Hover picking walks a ray through the buildings; once per frame is plenty.
        hoverX = event.clientX; hoverY = event.clientY
        if (!hoverQueued) { hoverQueued = true; requestAnimationFrame(() => { hoverQueued = false; this.hoverAt(hoverX, hoverY) }) }
        return
      }
      const previous = pointers.get(event.pointerId)!
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const distance = Math.hypot(a.x - b.x, a.y - b.y), angle = Math.atan2(b.y - a.y, b.x - a.x), midY = (a.y + b.y) / 2
        // Pinch zooms about the fingers, twist turns, and both fingers moving up or down tilts.
        this.zoomAt(pinch.distance / Math.max(distance, 1), (a.x + b.x) / 2, midY)
        this.goal.yaw -= angle - pinch.angle
        this.goal.pitch += (midY - pinch.midY) * 0.004
        pinch = { distance, angle, midY }
        this.clampGoal()
      } else if (drag) {
        drag.moved += Math.abs(dx) + Math.abs(dy)
        if (drag.rotate) {
          this.goal.yaw -= dx * 0.005
          this.goal.pitch += dy * 0.004
          this.clampGoal()
        } else {
          // Grab the ground: the point under the pointer stays under it, with no smoothing lag.
          const from = this.groundAt(previous.x, previous.y), to = this.groundAt(event.clientX, event.clientY)
          if (from && to) {
            const mx = from.x - to.x, mz = from.z - to.z
            this.cam.tx += mx; this.cam.tz += mz
            this.goal.tx += mx; this.goal.tz += mz
            this.clampGoal()
            this.cam.tx = this.goal.tx; this.cam.tz = this.goal.tz
            const now = performance.now()
            drag.samples.push({ t: now, x: mx, z: mz })
            while (drag.samples.length && now - drag.samples[0].t > 100) drag.samples.shift()
          }
        }
      }
    })
    const release = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (pointers.size < 2) pinch = null
      if (drag && drag.moved < 6 && event.type === 'pointerup' && !drag.rotate) {
        const hit = this.pickBuilding(event.clientX, event.clientY)
        this.onPick(hit && this.glows.has(hit.id) ? hit.id : null, hit?.name || null)
      } else if (drag && !drag.rotate && drag.samples.length > 1 && !this.reduced()) {
        // Keep gliding after a flick, as web maps do.
        const span = (performance.now() - drag.samples[0].t) / 1000
        if (span > 0 && span < 0.2) {
          const sx = drag.samples.reduce((s, p) => s + p.x, 0), sz = drag.samples.reduce((s, p) => s + p.z, 0)
          this.inertia = { vx: sx / Math.max(span, 0.03), vz: sz / Math.max(span, 0.03) }
        }
      }
      drag = null
    }
    el.addEventListener('pointerup', release)
    el.addEventListener('pointercancel', release)
    el.addEventListener('dblclick', (event) => {
      if (this.cinematic) return
      this.zoomAt(event.shiftKey ? 2 : 0.5, event.clientX, event.clientY, true)
    })
    el.addEventListener('wheel', (event) => {
      event.preventDefault()
      if (this.cinematic) return
      // Mouse wheels send large steps, trackpads and pinch gestures small ones; both zoom towards the cursor.
      const step = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY
      this.zoomAt(Math.exp(clamp(step, -300, 300) * (event.ctrlKey ? 0.01 : 0.0015)), event.clientX, event.clientY)
    }, { passive: false })
    const typing = (event: KeyboardEvent) => event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')
    window.addEventListener('keydown', (event) => {
      if (this.mode !== 'explorer' || typing(event) || event.metaKey || event.ctrlKey) return
      if (event.code === 'Equal' || event.code === 'NumpadAdd') this.zoomAt(0.6, undefined, undefined, true)
      else if (event.code === 'Minus' || event.code === 'NumpadSubtract') this.zoomAt(1 / 0.6, undefined, undefined, true)
      else this.keys.add(event.code)
    })
    window.addEventListener('keyup', (event) => this.keys.delete(event.code))
    window.addEventListener('blur', () => this.keys.clear())
  }

  private hoverAt(x: number, y: number) {
    const hit = this.pickBuilding(x, y)
    const id = hit && this.glows.has(hit.id) ? hit.id : null
    if (id === this.hover) return
    if (this.hover) this.markers.get(this.hover)?.el.classList.remove('hover')
    this.hover = id
    if (id) this.markers.get(id)?.el.classList.add('hover')
    this.input.style.cursor = id ? 'pointer' : ''
  }

  // Frame

  private frame(dt: number, time: number) {
    const e = this.e
    if (this.skipDive && e.state.state === 'dive' && e.state.diveT < 8.34) e.state.diveT = 8.34
    const state = e.state.state
    if (state === 'ride' && !this.entered) {
      this.entered = true
      document.body.classList.add('sc-entered')
    }
    if (state === 'title' || state === 'rise') {
      if (this.entered) {
        this.entered = false
        document.body.classList.remove('sc-entered')
      }
      if (this.mode !== 'street') this.setMode('street')
    }
    this.updateSun(dt)
    this.adaptResolution(dt, state)
    const explorer = state === 'free'
    let k = explorer ? 1 : 0
    if (explorer) {
      if (!this.blend || !this.blend.to) this.stepOrbit(dt)
      let pose = this.orbitPose()
      if (this.opening) {
        const opening = this.openingPose(dt)
        pose = opening.pose
        // Fog and draw distance open up as the view widens.
        k = Math.min(1, 0.5 + opening.progress)
      }
      if (this.blend) {
        this.blend.t += dt / this.blend.duration
        // An optional hold at the start keeps the opening shot on the sky before the descent.
        const hold = this.blend.hold ?? 0
        const t = ease(clamp((this.blend.t - hold) / (1 - hold), 0, 1))
        const to = this.blend.to ?? pose.pos, toLook = this.blend.toLook ?? pose.look
        // Lift the path so the camera clears rooftops on the way.
        const arc = Math.sin(Math.PI * t) * (this.blend.to ? 30 : 0)
        pose = {
          pos: this.blend.from.map((v, i) => v + (to[i] - v) * t + (i === 1 ? arc : 0)),
          look: this.blend.fromLook.map((v, i) => v + (toLook[i] - v) * t),
        }
        k = this.blend.to ? 1 - t : t
        if (this.blend.t >= 1) {
          const done = this.blend.done
          this.blend = null
          done?.()
        }
      }
      e.camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2])
      e.camera.lookAt(pose.look[0], pose.look[1], pose.look[2])
      // Keep the look-at point low on screen so the northern sky stays in view.
      Object.assign(e.state.free, { x: pose.pos[0], y: pose.pos[1], z: pose.pos[2], fov: EXPLORER_FOV, cy: 0.5 + 0.17 * k })
    }
    // The whole district stays drawn and unfogged from above.
    const tier = TIERS[this.tier]
    e.camera.far = 2600 + (tier.fogFar + 200) * k
    e.shared.uFogRange.value.set(this.streetFog[0] + tier.fogNear * k, this.streetFog[1] + tier.fogFar * k)
    this.bridge.district.setDrawScale(1 + tier.draw * k, k > 0.5 ? { x: this.cam.tx, z: this.cam.tz } : null, tier.trees)
    e.camera.updateMatrixWorld()

    for (const glow of this.glows.values()) {
      const c = glow.current, t = glow.target
      const rate = 1 - Math.exp(-6 * dt)
      for (let i = 0; i < 3; i++) c.color[i] += (t.color[i] - c.color[i]) * rate
      c.power += (t.power - c.power) * rate
      c.pulse += (t.pulse - c.pulse) * rate
      glow.uniforms.uColor.value.setRGB(c.color[0], c.color[1], c.color[2])
      glow.uniforms.uPower.value = c.power * (1 + c.pulse * (0.5 + 0.5 * Math.sin(time * 3.2)))
      glow.uniforms.uTime.value = time
      glow.mesh.visible = c.power > 0.01
    }
    const visible = this.entered && state !== 'dive'
    this.markerLayer.style.display = visible ? '' : 'none'
    this.overlay.style.display = visible ? '' : 'none'
    if (visible) {
      this.placeMarkers(explorer)
      this.drawOverlay(time)
      if (state === 'ride') this.checkNear()
    }
  }

  /**
   * The engine lowers its render resolution only while riding. The city view draws the whole
   * district, so it gets the same treatment here: drop resolution when frames are slow, raise it
   * again after a calm spell, with a cooldown so it never flips back and forth.
   */
  private frameTimes: number[] = []
  private nextResolutionChange = 0
  /** The visitor's setting; Auto starts from the device and steps down when frames stay slow. */
  graphics: Graphics = 'auto'
  tier: Tier = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600 || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'smooth' : 'balanced'
  private slowAtFloor = 0
  setGraphics(value: Graphics) {
    this.graphics = value
    if (value !== 'auto') this.tier = value
    this.e.state.quality = Math.min(this.e.state.quality, TIERS[this.tier].maxQ)
    window.dispatchEvent(new Event('resize'))
  }
  private adaptResolution(dt: number, state: string) {
    const e = this.e
    if (state === 'ride' || state === 'title' || dt <= 0 || dt > 1) { this.frameTimes.length = 0; return }
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 40) return
    const average = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes.length = 0
    const now = performance.now()
    if (now < this.nextResolutionChange) return
    let quality = e.state.quality as number
    const { maxQ, minQ } = TIERS[this.tier]
    if (average > 1 / 38 && quality <= minQ + 0.01) {
      // Already at the lowest resolution for this level: in Auto, drop a level after a few slow seconds.
      if (this.graphics === 'auto' && this.tier !== 'smooth' && ++this.slowAtFloor >= 3) {
        this.tier = this.tier === 'detailed' ? 'balanced' : 'smooth'
        this.slowAtFloor = 0
        this.onTier(this.tier)
      }
      return
    }
    this.slowAtFloor = 0
    if (average > 1 / 38) quality = Math.max(minQ, quality - 0.1)
    else if (average < 1 / 57 && quality < maxQ) quality = Math.min(maxQ, quality + 0.05)
    else if (quality > maxQ) quality = maxQ
    else return
    e.state.quality = quality
    // The engine resizes its render targets on window resize.
    window.dispatchEvent(new Event('resize'))
    this.nextResolutionChange = now + (average > 1 / 38 ? 1500 : 4000)
  }

  private updateSun(dt: number) {
    const settings = this.timeSettings()
    const now = new Date()
    if (settings.lapse) {
      // Time-lapse: one Helsinki day every six minutes.
      this.lapseMinutes = ((this.lapseMinutes ?? (settings.live ? helsinkiMinutes(now) : settings.minutes)) + dt * 4) % 1440
    } else this.lapseMinutes = null
    const minutes = this.lapseMinutes ?? (settings.live ? helsinkiMinutes(now) + now.getSeconds() / 60 : settings.minutes)
    const base = settings.season === 'summer' ? new Date(Date.UTC(now.getUTCFullYear(), 5, 21, 12)) : now
    const sun = sunPosition(atHelsinkiTime(base, minutes))
    // Lighting changes slowly; a few updates a second are enough unless time is running fast.
    if (settings.lapse || Math.abs(minutes - this.clock.minutes) > 0.5 || this.lastSunUpdate < 0) {
      this.bridge.visuals.setSun(sun.x, sun.y, sun.z, sun.elevation)
      this.lastSunUpdate = minutes
    }
    const phase = phaseOf(minutes, sun.elevation)
    const previous = this.clock.phase
    this.clock = { minutes, elevation: sun.elevation, phase }
    if (phase !== previous && this.entered) this.onPhase(phase, previous)
  }

  private stepOrbit(dt: number) {
    if (this.fly) {
      this.fly.t += dt / this.fly.duration
      const t = ease(clamp(this.fly.t, 0, 1))
      const { from, to } = this.fly
      // Pull back mid-flight on long hops.
      const hop = Math.hypot(to.tx - from.tx, to.tz - from.tz)
      const lift = Math.sin(Math.PI * t) * Math.min(500, hop * 0.35)
      this.cam = {
        tx: from.tx + (to.tx - from.tx) * t,
        tz: from.tz + (to.tz - from.tz) * t,
        dist: from.dist + (to.dist - from.dist) * t + lift,
        yaw: from.yaw + (to.yaw - from.yaw) * t,
        pitch: from.pitch + (to.pitch - from.pitch) * t,
      }
      if (this.fly.t >= 1) this.fly = null
      return
    }
    if (this.cinematic) {
      // Slow drift between scripted moves; the visitor has no control during a cutscene.
      this.cam.yaw += this.drift.yaw * dt
      this.cam.dist *= Math.exp(this.drift.dist * dt)
      this.cam.pitch = clamp(this.cam.pitch + this.drift.pitch * dt, 0.08, 1.45)
      this.goal = { ...this.cam }
      return
    }
    if (this.inertia.vx || this.inertia.vz) {
      const decay = Math.exp(-4.5 * dt)
      this.goal.tx += this.inertia.vx * dt; this.goal.tz += this.inertia.vz * dt
      this.cam.tx += this.inertia.vx * dt; this.cam.tz += this.inertia.vz * dt
      this.inertia.vx *= decay; this.inertia.vz *= decay
      if (Math.hypot(this.inertia.vx, this.inertia.vz) < 2) this.inertia = { vx: 0, vz: 0 }
    }
    const pan = this.cam.dist * 0.9 * dt
    const sin = Math.sin(this.cam.yaw), cos = Math.cos(this.cam.yaw)
    const ahead = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
    const side = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0)
    this.goal.tx += (-sin * ahead + cos * side) * pan
    this.goal.tz += (-cos * ahead - sin * side) * pan
    this.goal.yaw += ((this.keys.has('KeyQ') ? 1 : 0) - (this.keys.has('KeyE') ? 1 : 0)) * 1.2 * dt
    this.clampGoal()
    const rate = 1 - Math.exp(-9 * dt)
    for (const key of ['tx', 'tz', 'dist', 'yaw', 'pitch'] as const) this.cam[key] += (this.goal[key] - this.cam[key]) * rate
  }

  // Glow

  /** A dark apron under the horizon so the district never floats in empty space. */
  /**
   * Ground beyond the mapped district. Helsinki does not stop at the map's edge, so the ground keeps
   * going as a painted suggestion of city blocks (lit windows at night) to the north, east and west,
   * and sea to the south, all fading into the same haze as distant buildings. No hard square edge.
   */
  private addApron() {
    const e = this.e, B = this.map.bounds, s = 9000
    const geometry = new e.Geometry()
    const cx = (B.west + B.east) / 2, cz = (B.north + B.south) / 2
    geometry.setAttribute('position', new e.Attribute(new Float32Array([
      cx - s, -0.4, cz - s, cx - s, -0.4, cz + s, cx + s, -0.4, cz + s,
      cx - s, -0.4, cz - s, cx + s, -0.4, cz + s, cx + s, -0.4, cz - s,
    ]), 3))
    const mesh = new e.Mesh(geometry, new e.Material({
      uniforms: {
        uFogColor: e.shared.uFogColor, uFogRange: e.shared.uFogRange, uAmb: e.shared.uAmbSky, uGlow: e.shared.uGlow,
        uBounds: { value: [B.west, B.north, B.east, B.south] }, uTime: e.shared.uTime,
      },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uFogColor, uAmb; uniform vec2 uFogRange; uniform float uGlow, uTime; uniform float uBounds[4]; varying vec3 vWorld;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec2 p = vWorld.xz;
          float light = clamp(uAmb.b * 2.4, 0.08, 1.0);
          vec3 col;
          if (p.y > uBounds[3] + 40.0) {
            // The harbour and the sea beyond it.
            float wave = 0.5 + 0.5 * sin(p.x * 0.02 + uTime * 0.3) * sin(p.y * 0.017 - uTime * 0.2);
            col = mix(vec3(0.05, 0.13, 0.17), vec3(0.24, 0.34, 0.4), light) * (0.92 + 0.12 * wave);
          } else {
            // City blocks with streets between them; blocks get a warm scatter of windows after dark.
            vec2 cell = floor(p / 70.0), f = fract(p / 70.0);
            float h = hash(cell);
            float street = step(0.14, f.x) * step(f.x, 0.9) * step(0.14, f.y) * step(f.y, 0.9);
            vec3 roof = mix(vec3(0.23, 0.24, 0.25), vec3(0.42, 0.36, 0.3), h);
            vec3 road = vec3(0.16, 0.17, 0.18);
            col = mix(road, roof, street) * (0.35 + 0.75 * light);
            float window = step(0.86, hash(floor(p / 7.0))) * street * step(0.25, h);
            col += vec3(1.0, 0.66, 0.32) * window * uGlow * 0.55;
            if (h > 0.9) col = mix(col, vec3(0.12, 0.2, 0.12) * (0.4 + light), street);
          }
          // Fade with distance from the camera, and softly with distance from the mapped district.
          float dx = max(max(uBounds[0] - p.x, p.x - uBounds[2]), 0.0), dz = max(max(uBounds[1] - p.y, p.y - uBounds[3]), 0.0);
          float edge = smoothstep(0.0, 1400.0, length(vec2(dx, dz)));
          float fog = smoothstep(uFogRange.x * 0.6, uFogRange.y, distance(cameraPosition, vWorld));
          gl_FragColor = vec4(mix(col, uFogColor, clamp(max(fog, edge * 0.85), 0.0, 1.0)), 1.0);
        }`,
    }))
    mesh.frustumCulled = false
    mesh.renderOrder = -5
    e.scene.add(mesh)
  }

  private glowMesh(building: Building, x: number, z: number, partner = false) {
    const e = this.e
    const positions: number[] = [], fades: number[] = []
    const top = building.h + 0.6
    const push = (px: number, py: number, pz: number, fade: number) => { positions.push(px, py, pz); fades.push(fade) }
    for (const ring of building.rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]
        push(a[0], 0, a[1], 0.25); push(b[0], 0, b[1], 0.25); push(b[0], top, b[1], 1)
        push(a[0], 0, a[1], 0.25); push(b[0], top, b[1], 1); push(a[0], top, a[1], 1)
      }
    }
    const flat = building.rings.flat()
    for (const triangle of building.triangles) for (const index of triangle) push(flat[index][0], top, flat[index][1], 0.8)
    // A light beam, visible across the city and from street level. Partners get a taller, wider one
    // and a halo ring above the roof.
    const beam = partner ? 190 : 70, half = partner ? 3.2 : 1.6
    if (partner) {
      const radius = Math.max(8, Math.min(30, Math.hypot(building.bounds[2] - building.bounds[0], building.bounds[3] - building.bounds[1]) * 0.42))
      for (const [lift, width] of [[9, 1.4], [16, 0.8]]) {
        for (let i = 0; i < 48; i++) {
          const a0 = (i / 48) * Math.PI * 2, a1 = ((i + 1) / 48) * Math.PI * 2
          const r = radius * (lift === 16 ? 0.7 : 1)
          const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r]
          push(p0[0], top + lift, p0[1], 1.4); push(p1[0], top + lift, p1[1], 1.4); push(p1[0], top + lift + width, p1[1], 1.6)
          push(p0[0], top + lift, p0[1], 1.4); push(p1[0], top + lift + width, p1[1], 1.6); push(p0[0], top + lift + width, p0[1], 1.6)
        }
      }
    }
    for (const [dx, dz] of [[half, 0], [0, half]]) {
      push(x - dx, top, z - dz, 1.3); push(x + dx, top, z + dz, 1.3); push(x + dx, top + beam, z + dz, 0)
      push(x - dx, top, z - dz, 1.3); push(x + dx, top + beam, z + dz, 0); push(x - dx, top + beam, z - dz, 0)
    }
    const geometry = new e.Geometry()
    geometry.setAttribute('position', new e.Attribute(new Float32Array(positions), 3))
    geometry.setAttribute('aFade', new e.Attribute(new Float32Array(fades), 1))
    const uniforms = { uColor: { value: new e.Color(1, 1, 1) }, uPower: { value: 0 }, uTime: { value: 0 }, uPartner: { value: partner ? 1 : 0 } }
    const material = new e.Material({
      uniforms,
      vertexShader: `attribute float aFade; varying float vFade; varying vec3 vWorld;
        void main(){ vFade = aFade; vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uPower; uniform float uTime; uniform float uPartner; varying float vFade; varying vec3 vWorld;
        void main(){
          float scan = 0.82 + 0.18 * sin(vWorld.y * 0.9 - uTime * 2.4);
          vec3 colour = uColor;
          if (uPartner > 0.5) {
            // Junction partners: aurora bands, green to violet with a gold rim, drifting upwards.
            float band = 0.5 + 0.5 * sin(vWorld.y * 0.07 - uTime * 1.1 + vWorld.x * 0.02);
            colour = mix(vec3(0.36, 0.95, 0.69), vec3(0.62, 0.45, 1.0), band);
            colour = mix(colour, vec3(1.0, 0.82, 0.42), smoothstep(1.35, 1.6, vFade));
            scan = 0.75 + 0.25 * sin(vWorld.y * 0.35 - uTime * 3.0);
          }
          // Up close the shell thins out so it never floods a street-level view.
          float near = 0.12 + 0.88 * smoothstep(25.0, 260.0, distance(cameraPosition, vWorld));
          gl_FragColor = vec4(colour * uPower * min(vFade, 1.3) * scan * near, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: 2,
      side: 2,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    const mesh = new e.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.renderOrder = 5
    this.glowGroup.add(mesh)
    return { mesh, uniforms, top }
  }

  // Markers

  setMarkers(inputs: MarkerInput[]) {
    this.markersDirty = true
    this.bridge.district.setMinimapOverlay({ buildings: inputs.map((m) => m.buildingId) })
    const keep = new Set(inputs.map((m) => m.buildingId))
    for (const [id, marker] of this.markers) if (!keep.has(id)) { marker.el.remove(); this.markers.delete(id) }
    for (const input of inputs) {
      const building = this.buildings.get(input.buildingId)
      if (!building) continue
      if (!this.glows.has(input.buildingId)) {
        const made = this.glowMesh(building, input.x, input.z, Boolean(input.partner))
        const start: Glow = { color: hexToRgb(input.color), power: 0, pulse: 0 }
        this.glows.set(input.buildingId, { ...made, target: { ...start }, current: start, x: input.x, z: input.z })
      }
      const glow = this.glows.get(input.buildingId)!
      const gold = input.funded && input.state !== 'dim'
      // Only fresh news pulses; everything else holds a steady light.
      glow.target = {
        color: hexToRgb(gold ? '#f2c14e' : input.color),
        power: input.state === 'dim' ? 0.05 : input.state === 'selected' ? 1.4 : input.state === 'match' || input.state === 'flash' ? 1.1 : input.partner ? 1 : gold ? 0.7 : 0.4,
        pulse: input.state === 'flash' ? 0.6 : 0,
      }
      let marker = this.markers.get(input.buildingId)
      if (!marker) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'sc-marker'
        el.addEventListener('click', () => this.onPick(input.buildingId, null))
        this.markerLayer.append(el)
        marker = { el, input, top: glow.top }
        this.markers.set(input.buildingId, marker)
      }
      marker.input = input
      const el = marker.el
      el.dataset.state = input.state
      el.style.setProperty('--c', input.color)
      el.setAttribute('aria-label', `${input.title}, ${input.subtitle}`)
      const logos = input.logos.slice(0, 3).map((logo) => logo.src
        ? `<span class="sc-logo${logo.dark ? ' dark' : ''}"><img src="${logo.src}" alt="" loading="lazy" /></span>`
        : `<span class="sc-logo sc-initials">${escapeHtml(logo.initials)}</span>`).join('')
      el.classList.toggle('partner', Boolean(input.partner))
      if (input.partner) {
        const p = input.partner
        const tier = { featured: 'Featured partner', main: 'Main partner', challenge: 'Challenge partner', tech: 'Tech partner', supporter: 'Supporter', organiser: 'Organiser', listed: 'Partner' }[p.tier] ?? 'Partner'
        el.innerHTML = `
        <span class="sc-partner-card">
          <span class="sc-partner-logo">${p.logo ? `<img src="${p.logo}" alt="" />` : `<b>${escapeHtml(p.name)}</b>`}</span>
          <span class="sc-partner-text"><b>${escapeHtml(p.name)}</b><small>Junction 2026, ${tier.toLowerCase()}${input.count > 1 ? `, +${input.count - 1} here` : ''}</small></span>
        </span>
        <span class="sc-stem partner"></span>`
        // Wordmarks and square logos get the same visual area, so no partner looks bigger than another.
        const img = el.querySelector<HTMLImageElement>('.sc-partner-logo img')
        if (img) {
          const fit = () => {
            const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
            if (!aspect) return
            const height = clamp(Math.sqrt(1050 / aspect), 13, 30)
            img.style.height = `${height.toFixed(1)}px`
            img.style.width = `${Math.min(110, height * aspect).toFixed(1)}px`
          }
          if (img.complete) fit()
          else img.addEventListener('load', fit, { once: true })
        }
        continue
      }
      el.innerHTML = `
        <span class="sc-pin">${input.launch ? '<i class="sc-ping"></i>' : ''}${logos}${input.count > 3 ? `<span class="sc-logo sc-more">+${input.count - 3}</span>` : ''}</span>
        <span class="sc-tag"><b>${escapeHtml(input.title)}</b><small>${escapeHtml(input.subtitle)}</small></span>
        <span class="sc-badges">${input.hiring ? '<i class="hiring">Hiring</i>' : ''}${input.funded ? '<i class="funded">Funded</i>' : ''}${input.news ? '<i class="news">News</i>' : ''}</span>
        <span class="sc-stem"></span>`
    }
  }

  private project(x: number, y: number, z: number) {
    const v = this.vec.set(x, y, z).project(this.e.camera)
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight, front: v.z > -1 && v.z < 1 }
  }

  private markerKey = ''
  private markersDirty = true
  private placeMarkers(explorer: boolean) {
    const camera = this.e.camera.position
    // Skip the DOM work entirely while the camera and markers are unchanged.
    const q = this.e.camera.quaternion
    const key = `${camera.x.toFixed(2)},${camera.y.toFixed(2)},${camera.z.toFixed(2)},${q.x.toFixed(4)},${q.y.toFixed(4)},${q.z.toFixed(4)},${q.w.toFixed(4)},${innerWidth},${innerHeight}`
    if (key === this.markerKey && !this.markersDirty) return
    this.markerKey = key
    this.markersDirty = false
    const limit = explorer ? 5200 : 420
    for (const marker of this.markers.values()) {
      const { input, el } = marker
      const lift = explorer ? 10 : 6
      const p = this.project(input.x, marker.top + lift, input.z)
      const distance = Math.hypot(camera.x - input.x, camera.y - marker.top, camera.z - input.z)
      const shown = p.front && distance < limit && p.x > -120 && p.x < window.innerWidth + 120 && p.y > -80 && p.y < window.innerHeight + 160
      if (!shown) { if (el.style.display !== 'none') el.style.display = 'none'; continue }
      const scale = explorer ? clamp((input.partner ? 700 : 520) / distance, input.partner ? 0.72 : 0.5, 1.05) : clamp(60 / distance, 0.55, 1)
      if (el.style.display === 'none') el.style.display = ''
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`
      const z = String(input.state === 'selected' ? 90000 : input.partner ? 85000 - Math.round(distance / 10) : Math.max(1, 80000 - Math.round(distance / 10) * 10))
      if (el.style.zIndex !== z) el.style.zIndex = z
      // Names collapse when far away; logos stay.
      const compact = !input.partner && input.state !== 'selected' && input.state !== 'match' && distance > (explorer ? 1250 : 180)
      if (el.classList.contains('compact') !== compact) el.classList.toggle('compact', compact)
    }
  }

  private checkNear() {
    const player = this.e.player
    let best: string | null = null, bestDistance = 34
    for (const [id, glow] of this.glows) {
      const building = this.buildings.get(id)!
      const dx = Math.max(building.bounds[0] - player.gx, 0, player.gx - building.bounds[2])
      const dz = Math.max(building.bounds[1] - player.gz, 0, player.gz - building.bounds[3])
      const distance = Math.min(Math.hypot(dx, dz) + 8, Math.hypot(glow.x - player.gx, glow.z - player.gz))
      if (distance < bestDistance) { bestDistance = distance; best = id }
    }
    if (best !== this.near) {
      this.near = best
      this.onNear(best)
    }
  }

  // Overlay: links and routes

  setLinks(links: Link[]) { this.links = links }
  setRoutes(routes: { points: number[][]; color: string }[]) {
    this.routes = routes
    // Routes are shown on the street-level minimap only; on the 3D streets they looked heavy.
    this.bridge.district.setMinimapOverlay({ routes })
  }


  private drawOverlay(time: number) {
    const canvas = this.overlay, ctx = this.ctx
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth, height = window.innerHeight
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (!this.links.length) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const stroke = (points: number[][], color: string, lineWidth: number, dash: number[] | null, flow: number) => {
      ctx.beginPath()
      let pen = false
      for (const [x, y, z] of points) {
        const p = this.project(x, y, z)
        if (!p.front) { pen = false; continue }
        if (pen) ctx.lineTo(p.x, p.y)
        else ctx.moveTo(p.x, p.y)
        pen = true
      }
      ctx.setLineDash(dash ?? [])
      ctx.lineDashOffset = flow
      // A wide faint stroke reads as a glow; canvas shadowBlur cost several ms per line.
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.22
      ctx.lineWidth = lineWidth * 3.2
      ctx.stroke()
      ctx.globalAlpha = 0.95
      ctx.lineWidth = lineWidth
      ctx.stroke()
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(0.6, lineWidth * 0.28)
      ctx.stroke()
    }
    for (const link of this.links) {
      const a = this.glows.get(link.a), b = this.glows.get(link.b)
      if (!a || !b || a === b) continue
      const span = Math.hypot(a.x - b.x, a.z - b.z)
      const rise = clamp(span * 0.2, 24, 170)
      const points: number[][] = []
      for (let i = 0; i <= 28; i++) {
        const t = i / 28
        points.push([a.x + (b.x - a.x) * t, a.top + 8 + (b.top - a.top) * t + Math.sin(Math.PI * t) * rise, a.z + (b.z - a.z) * t])
      }
      stroke(points, link.color, link.width, link.dashed ? [3, 9] : null, link.dashed ? -time * 14 : 0)
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  // Picking and routing

  private buildingAt(x: number, z: number, y: number) {
    for (const b of this.grid.get(`${Math.floor(x / 60)},${Math.floor(z / 60)}`) ?? []) {
      if (y <= b.h && x >= b.bounds[0] && x <= b.bounds[2] && z >= b.bounds[1] && z <= b.bounds[3] && this.bridge.geography.inPolygon(x, z, b.rings)) return b
    }
    return null
  }

  pickBuilding(clientX: number, clientY: number) {
    const camera = this.e.camera
    const far = this.vec.set((clientX / window.innerWidth) * 2 - 1, 1 - (clientY / window.innerHeight) * 2, 0.5).unproject(camera)
    const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z
    let dx = far.x - ox, dy = far.y - oy, dz = far.z - oz
    const length = Math.hypot(dx, dy, dz) || 1
    dx /= length; dy /= length; dz /= length
    if (dy >= -0.01) return null
    // Start where the ray drops below the tallest roofs.
    const start = Math.max(0, (oy - 110) / -dy)
    const end = oy / -dy
    for (let t = start; t <= end; t += 2.5) {
      const hit = this.buildingAt(ox + dx * t, oz + dz * t, oy + dy * t)
      if (hit) return hit
    }
    return null
  }

  private buildGraph() {
    const nodes: number[][] = [], index = new Map<string, number>(), edges = new Map<number, [number, number][]>(), cells = new Map<string, number[]>()
    const node = (p: number[]) => {
      const key = `${p[0]},${p[1]}`
      let id = index.get(key)
      if (id === undefined) {
        id = nodes.length
        nodes.push(p)
        index.set(key, id)
        edges.set(id, [])
        const cell = `${Math.floor(p[0] / 80)},${Math.floor(p[1] / 80)}`
        if (!cells.has(cell)) cells.set(cell, [])
        cells.get(cell)!.push(id)
      }
      return id
    }
    for (const road of this.map.roads) {
      if (road.kind === 'tram' || road.kind === 'steps') continue
      // Riders prefer streets; footways cost a little more.
      const cost = ['footway', 'path', 'cycleway'].includes(road.kind) ? 1.25 : 1
      for (let i = 1; i < road.points.length; i++) {
        const a = node(road.points[i - 1]), b = node(road.points[i])
        const length = Math.hypot(road.points[i][0] - road.points[i - 1][0], road.points[i][1] - road.points[i - 1][1]) * cost
        edges.get(a)!.push([b, length])
        edges.get(b)!.push([a, length])
      }
    }
    return { nodes, edges, cells }
  }

  private nearestNode(x: number, z: number) {
    const graph = (this.graph ??= this.buildGraph())
    let best = -1, bestDistance = Infinity
    const ci = Math.floor(x / 80), cj = Math.floor(z / 80)
    for (let radius = 0; radius < 8 && best < 0; radius++)
      for (let i = ci - radius; i <= ci + radius; i++)
        for (let j = cj - radius; j <= cj + radius; j++)
          for (const id of graph.cells.get(`${i},${j}`) ?? []) {
            const d = Math.hypot(graph.nodes[id][0] - x, graph.nodes[id][1] - z)
            if (d < bestDistance) { bestDistance = d; best = id }
          }
    return best
  }

  /** Shortest path along mapped streets and paths. Null when the two points are not connected. */
  route(from: { x: number; z: number }, to: { x: number; z: number }) {
    const graph = (this.graph ??= this.buildGraph())
    const start = this.nearestNode(from.x, from.z), goal = this.nearestNode(to.x, to.z)
    if (start < 0 || goal < 0) return null
    const target = graph.nodes[goal]
    const cost = new Map<number, number>([[start, 0]]), parent = new Map<number, number>()
    // Binary heap keyed by estimated total cost.
    const heap: [number, number][] = [[0, start]]
    const pushHeap = (item: [number, number]) => {
      heap.push(item)
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1
        if (heap[p][0] <= heap[i][0]) break
        ;[heap[p], heap[i]] = [heap[i], heap[p]]
        i = p
      }
    }
    const popHeap = () => {
      const top = heap[0], last = heap.pop()!
      if (heap.length) {
        heap[0] = last
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1
          let m = i
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r
          if (m === i) break
          ;[heap[m], heap[i]] = [heap[i], heap[m]]
          i = m
        }
      }
      return top
    }
    const closed = new Set<number>()
    while (heap.length) {
      const [, current] = popHeap()
      if (current === goal) break
      if (closed.has(current)) continue
      closed.add(current)
      for (const [next, length] of graph.edges.get(current)!) {
        const total = cost.get(current)! + length
        if (total < (cost.get(next) ?? Infinity)) {
          cost.set(next, total)
          parent.set(next, current)
          pushHeap([total + Math.hypot(graph.nodes[next][0] - target[0], graph.nodes[next][1] - target[1]), next])
        }
      }
    }
    if (!cost.has(goal)) return null
    const points: number[][] = [[to.x, to.z]]
    for (let id: number | undefined = goal; id !== undefined; id = parent.get(id)) points.push(graph.nodes[id])
    points.push([from.x, from.z])
    return { points: points.reverse(), metres: cost.get(goal)! }
  }

  /** A clear standing point on a street next to a map position. */
  private clearSpot(near: { x: number; z: number }) {
    const graph = (this.graph ??= this.buildGraph())
    const probe = this.bridge.geography.districtProbe
    let best: number[] | null = null, bestDistance = Infinity
    const ci = Math.floor(near.x / 80), cj = Math.floor(near.z / 80)
    for (let i = ci - 2; i <= ci + 2; i++)
      for (let j = cj - 2; j <= cj + 2; j++)
        for (const id of graph.cells.get(`${i},${j}`) ?? []) {
          const p = graph.nodes[id]
          const d = Math.hypot(p[0] - near.x, p[1] - near.z)
          // Stand a few metres back so the building is in view.
          if (d > 9 && d < bestDistance && !probe(p[0], p[1], 0, 1.2).blocked) { bestDistance = d; best = p }
        }
    return best ? { x: best[0], z: best[1] } : { x: this.e.player.gx, z: this.e.player.gz }
  }

  playerPosition() {
    return { x: this.e.player.gx as number, z: this.e.player.gz as number }
  }

  viewCentre() {
    return this.mode === 'explorer' ? { x: this.cam.tx, z: this.cam.tz } : this.playerPosition()
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
