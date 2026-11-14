import { create } from 'zustand'
import {
  emptyFilters, filtersActive, matchesFilters, parseQueryLocally,
  type NewsItem, type SearchFilters, type Startup, type Suggestion,
} from '../shared/startup-schema'
import { tourOrder, type ConnectionKind, type Discovery } from './logic'
import type { CityScene, Mode } from './scene'

export type Meta = {
  snapshotAt: string
  note: string
  lastLiveAt: string | null
  contextAvailable: boolean
  geminiAvailable: boolean
  models: { fast: string; research: string; deep: string } | null
  monitored: string[]
}

type RefreshState =
  | { status: 'idle' }
  | { status: 'loading'; scope: string }
  | { status: 'success'; message: string; at: string }
  | { status: 'error'; message: string }

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; mode: 'gemini' | 'local'; model: string | null; query: string }

export type Route = { targetId: string; metres: number } | { tour: string[]; metres: number }

type State = {
  scene: CityScene | null
  loaded: boolean
  loadError: string | null
  startups: Startup[]
  suggestions: { generatedAt: string | null; model: string | null; items: Suggestion[] }
  meta: Meta | null
  /** 'cached' until a Context.dev refresh succeeds in this session. */
  dataMode: 'cached' | 'live'
  entered: boolean
  mode: Mode
  selectedBuilding: string | null
  selectedId: string | null
  query: string
  filters: SearchFilters
  search: SearchState
  refresh: RefreshState
  /** Headlines first seen during this session's refreshes. */
  freshNews: Record<string, true>
  flash: Record<string, number>
  connectionsOn: boolean
  connectionFocus: string | null
  kinds: Record<ConnectionKind, boolean>
  suggesting: boolean
  route: Route | null
  near: string | null
  discovered: Record<string, Discovery>
  panel: 'feed' | 'missions' | 'directory' | null
  demo: { active: boolean; step: number; paused: boolean }
  toast: { id: number; text: string; tone: 'info' | 'gold' | 'green' } | null

  load(): Promise<void>
  setScene(scene: CityScene): void
  select(buildingId: string | null, startupId?: string | null, visit?: 'map' | 'street' | null): void
  setFilters(filters: SearchFilters, query?: string): void
  toggleIndustry(id: SearchFilters['industries'][number]): void
  toggleFlag(flag: 'hiring' | 'recentlyFunded' | 'hasNews'): void
  clearSearch(): void
  ask(query: string): Promise<void>
  refreshSignals(ids?: string[]): Promise<void>
  setMode(mode: Mode): void
  toggleConnections(focus?: string | null): void
  suggestConnections(): Promise<void>
  navigateTo(startupId: string | null): void
  tourResults(): void
  notify(text: string, tone?: 'info' | 'gold' | 'green'): void
  set(partial: Partial<State>): void
}

const STORAGE = 'startup-city-discoveries-v1'
const savedDiscoveries = (): Record<string, Discovery> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? '{}')
    return value && typeof value === 'object' ? value as Record<string, Discovery> : {}
  } catch {
    return {}
  }
}

const post = async (path: string, body?: unknown, timeout = 60_000) => {
  const response = await fetch(path, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, data }
}

let toastId = 0
// A plain static file: readable even when the API process is down.
const originalFetch = (path: string) => fetch(path, { signal: AbortSignal.timeout(15_000) })

export const useCity = create<State>((set, get) => ({
  scene: null,
  loaded: false,
  loadError: null,
  startups: [],
  suggestions: { generatedAt: null, model: null, items: [] },
  meta: null,
  dataMode: 'cached',
  entered: false,
  mode: 'street',
  selectedBuilding: null,
  selectedId: null,
  query: '',
  filters: emptyFilters,
  search: { status: 'idle' },
  refresh: { status: 'idle' },
  freshNews: {},
  flash: {},
  connectionsOn: false,
  connectionFocus: null,
  kinds: { investor: true, partnership: true, industry: true, similar: true, opportunity: true },
  suggesting: false,
  route: null,
  near: null,
  discovered: savedDiscoveries(),
  panel: null,
  demo: { active: false, step: 0, paused: false },
  toast: null,

  set: (partial) => set(partial),

  async load() {
    try {
      const response = await fetch('/api/startups', { signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error('unavailable')
      const data = await response.json()
      set({ startups: data.startups, suggestions: data.suggestions, meta: data.meta, loaded: true, loadError: null, dataMode: data.meta.lastLiveAt ? 'live' : 'cached' })
    } catch {
      // The API is down: fall back to the snapshot bundled with the app.
      try {
        const snapshot: { meta: { generatedAt: string; note: string }; startups: Startup[] } = await (await originalFetch('/data/startups-snapshot.json')).json()
        set({
          startups: snapshot.startups,
          meta: { snapshotAt: snapshot.meta.generatedAt, note: snapshot.meta.note, lastLiveAt: null, contextAvailable: false, geminiAvailable: false, models: null, monitored: [] },
          loaded: true,
          loadError: 'The STARTUP CITY server is unreachable. Showing the bundled snapshot.',
          dataMode: 'cached',
        })
      } catch {
        set({ loaded: true, loadError: 'Startup data could not be loaded.' })
      }
    }
  },

  setScene: (scene) => set({ scene }),

  select(buildingId, startupId = null, visit = 'map') {
    const { startups, discovered } = get()
    if (!buildingId && !startupId) { set({ selectedBuilding: null, selectedId: null }); return }
    const inBuilding = startups.filter((s) => s.location?.buildingId === buildingId)
    const chosen = startupId ? startups.find((s) => s.id === startupId) : inBuilding.find((s) => s.industry !== 'hub') ?? inBuilding[0]
    if (!chosen) { set({ selectedBuilding: null, selectedId: null }); return }
    const next = { ...discovered }
    // Visiting a company in either mode discovers it; street level earns the bonus once.
    if (visit && chosen.industry !== 'hub' && chosen.location) {
      const previous = next[chosen.id]
      if (!previous || (visit === 'street' && !previous.street)) {
        next[chosen.id] = { at: previous?.at ?? new Date().toISOString(), street: visit === 'street' || Boolean(previous?.street) }
        try { localStorage.setItem(STORAGE, JSON.stringify(next)) } catch { /* Progress then lasts for this visit only. */ }
        if (!previous) get().notify(`Discovered ${chosen.name} · +${visit === 'street' ? 150 : 100} points`, 'green')
      }
    }
    set({ selectedBuilding: chosen.location?.buildingId ?? null, selectedId: chosen.id, discovered: next, panel: get().panel === 'directory' ? null : get().panel })
  },

  setFilters(filters, query) {
    set({ filters, ...(query !== undefined ? { query } : {}), route: null })
  },
  toggleIndustry(id) {
    const { filters } = get()
    const industries = filters.industries.includes(id) ? filters.industries.filter((i) => i !== id) : [...filters.industries, id]
    set({ filters: { ...filters, industries }, search: { status: 'idle' }, route: null })
  },
  toggleFlag(flag) {
    const { filters } = get()
    set({ filters: { ...filters, [flag]: !filters[flag] }, search: { status: 'idle' }, route: null })
  },
  clearSearch() {
    set({ filters: emptyFilters, query: '', search: { status: 'idle' }, route: null })
    get().scene?.setRoutes([])
  },

  async ask(query) {
    const text = query.trim()
    if (!text) return
    set({ query: text, search: { status: 'loading' } })
    let result: { mode: 'gemini' | 'local'; filters: SearchFilters; model: string | null }
    try {
      const { ok, data } = await post('/api/search', { query: text }, 14_000)
      if (!ok) throw new Error('search failed')
      result = data
    } catch {
      result = { mode: 'local', filters: parseQueryLocally(text), model: null }
    }
    set({ filters: result.filters, search: { status: 'done', mode: result.mode, model: result.model, query: text }, route: null })
    const { scene, startups, mode } = get()
    scene?.setRoutes([])
    const matches = startups.filter((s) => s.location && matchesFilters(s, result.filters))
    if (filtersActive(result.filters) && matches.length && mode === 'explorer') scene?.frameBounds(matches.map((s) => s.location!))
  },

  async refreshSignals(ids) {
    if (get().refresh.status === 'loading') return
    const { startups } = get()
    const scope = ids?.length === 1 ? startups.find((s) => s.id === ids[0])?.name ?? 'company' : 'startup signals'
    set({ refresh: { status: 'loading', scope } })
    try {
      const { ok, data } = await post('/api/signals/refresh', ids ? { ids } : {}, 90_000)
      if (!ok) {
        set({ refresh: { status: 'error', message: data.error ?? 'Context.dev could not be reached. Showing the cached snapshot.' } })
        return
      }
      const updated: Startup[] = data.startups ?? []
      const byId = new Map(updated.map((s) => [s.id, s]))
      const freshNews = { ...get().freshNews }
      const flash = { ...get().flash }
      let headlines = 0
      for (const result of data.results as { id: string; newNews: NewsItem[] }[]) {
        for (const item of result.newNews) { freshNews[item.id] = true; headlines++ }
        const building = byId.get(result.id)?.location?.buildingId
        if (building && result.newNews.length) flash[building] = Date.now() + 20_000
      }
      const read = (data.results as { status: string }[]).filter((r) => r.status !== 'failed').length
      const message = read
        ? `${read} ${read === 1 ? 'company' : 'companies'} re-read · ${headlines ? `${headlines} new headline${headlines === 1 ? '' : 's'}` : 'no new headlines'}${data.remaining ? ` · ${data.remaining} more queued` : ''}`
        : `Already up to date · read ${ids?.length === 1 ? 'within the last minute' : 'within the last 10 minutes'}`
      set({
        startups: get().startups.map((s) => byId.get(s.id) ?? s),
        freshNews, flash,
        dataMode: 'live',
        refresh: { status: 'success', message, at: data.retrievedAt ?? new Date().toISOString() },
        meta: get().meta && { ...get().meta!, lastLiveAt: data.retrievedAt ?? get().meta!.lastLiveAt },
      })
    } catch {
      set({ refresh: { status: 'error', message: 'The server did not answer. Showing the cached snapshot.' } })
    }
  },

  setMode(mode) {
    const { scene, selectedId, startups } = get()
    if (!scene || !scene.entered) return
    if (mode === 'explorer') scene.enterExplorer()
    else {
      const target = startups.find((s) => s.id === selectedId)?.location
      scene.enterStreet(target ? { x: target.x, z: target.z } : undefined)
    }
  },

  toggleConnections(focus) {
    const { connectionsOn, connectionFocus } = get()
    if (focus !== undefined && focus !== null) set({ connectionsOn: true, connectionFocus: focus })
    else if (connectionsOn && connectionFocus) set({ connectionFocus: null })
    else set({ connectionsOn: !connectionsOn, connectionFocus: null })
  },

  async suggestConnections() {
    if (get().suggesting) return
    set({ suggesting: true })
    try {
      const { ok, data } = await post('/api/connections/suggest', undefined, 60_000)
      if (data.suggestions) set({ suggestions: data.suggestions })
      if (!ok) get().notify(data.error ?? 'Gemini could not suggest connections right now.')
    } catch {
      get().notify('Gemini could not suggest connections right now.')
    } finally {
      set({ suggesting: false })
    }
  },

  navigateTo(startupId) {
    const { scene, startups } = get()
    const target = startups.find((s) => s.id === startupId)?.location
    if (!scene || !target) { scene?.setRoutes([]); set({ route: null }); return }
    const path = scene.route(scene.playerPosition(), target)
    if (!path) { get().notify('No mapped street connects these two points.'); return }
    scene.setRoutes([{ points: path.points, color: '#22d3ee' }])
    set({ route: { targetId: startupId!, metres: path.metres } })
  },

  tourResults() {
    const { scene, startups, filters } = get()
    if (!scene) return
    const stops = startups.filter((s) => s.location && matchesFilters(s, filters)).map((s) => ({ id: s.id, x: s.location!.x, z: s.location!.z, building: s.location!.buildingId }))
    // One stop per building.
    const unique = stops.filter((s, i) => stops.findIndex((o) => o.building === s.building) === i)
    if (unique.length < 2) { get().notify('A route needs at least two matching buildings.'); return }
    const order = tourOrder(scene.viewCentre(), unique)
    const legs: { points: number[][]; color: string }[] = []
    let metres = 0
    for (let i = 1; i < order.length; i++) {
      const leg = scene.route(order[i - 1], order[i])
      if (leg) { legs.push({ points: leg.points, color: '#a78bfa' }); metres += leg.metres }
    }
    scene.setRoutes(legs)
    set({ route: { tour: order.map((s) => s.id), metres } })
  },

  notify(text, tone = 'info') {
    const id = ++toastId
    set({ toast: { id, text, tone } })
    setTimeout(() => { if (get().toast?.id === id) set({ toast: null }) }, 4200)
  },
}))
