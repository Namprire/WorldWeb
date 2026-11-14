import { AnimatePresence, motion } from 'framer-motion'
import {
  Award, Building2, ChevronLeft, ChevronRight, Compass, Footprints, List, Loader2, MapPin, Network, Newspaper, Pause, Play,
  Radio, RefreshCw, RotateCcw, Route as RouteIcon, Search, Sparkles, Target, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  INDUSTRIES, filtersActive, industryIds, isHiring, matchesFilters, recentFunding, recentNews,
  type IndustryId, type Startup,
} from '../shared/startup-schema'
import {
  CONNECTION_KINDS, MISSION_GOAL, badges, buildConnections, formatDate, initials, missionProgress, relativeDate, score,
  type ConnectionKind,
} from './logic'
import { Logo, Panel } from './Panel'
import type { MarkerInput } from './scene'
import { useCity } from './store'

const placedOf = (startups: Startup[]) => startups.filter((s) => s.location)

/** Keeps the 3D layer in step with the data: markers, building glow, links. */
function useSceneSync() {
  const scene = useCity((s) => s.scene)
  const startups = useCity((s) => s.startups)
  const filters = useCity((s) => s.filters)
  const selectedBuilding = useCity((s) => s.selectedBuilding)
  const flash = useCity((s) => s.flash)
  const connectionsOn = useCity((s) => s.connectionsOn)
  const connectionFocus = useCity((s) => s.connectionFocus)
  const kinds = useCity((s) => s.kinds)
  const suggestions = useCity((s) => s.suggestions)

  useEffect(() => {
    if (!scene) return
    const active = filtersActive(filters)
    const groups = new Map<string, Startup[]>()
    for (const s of placedOf(startups)) groups.set(s.location!.buildingId, [...(groups.get(s.location!.buildingId) ?? []), s])
    const now = Date.now()
    const inputs: MarkerInput[] = [...groups.entries()].map(([buildingId, members]) => {
      const hub = members.find((s) => s.industry === 'hub')
      const companies = members.filter((s) => s.industry !== 'hub')
      const matching = companies.filter((s) => matchesFilters(s, filters))
      const shown = active && matching.length ? matching : companies.length ? companies : members
      const lead = shown[0]
      return {
        buildingId,
        x: lead.location!.x,
        z: lead.location!.z,
        title: hub ? hub.name : members.length > 1 ? `${lead.name} +${members.length - 1}` : lead.name,
        subtitle: hub ? `${companies.length} mapped startups` : members.length > 1 ? `${members.length} companies` : INDUSTRIES[lead.industry].label,
        color: INDUSTRIES[lead.industry].color,
        logos: (hub ? [hub, ...shown] : shown).map((s) => ({ src: s.logo, initials: initials(s.name), dark: Boolean(s.logoOnDark) })),
        count: hub ? shown.length + 1 : shown.length,
        hiring: shown.some(isHiring),
        funded: shown.some((s) => recentFunding(s)),
        news: shown.some((s) => recentNews(s).length > 0),
        launch: shown.some((s) => recentNews(s).some((n) => n.eventType === 'launch')),
        state: selectedBuilding === buildingId ? 'selected' : active ? (matching.length ? 'match' : 'dim') : (flash[buildingId] ?? 0) > now ? 'match' : 'normal',
      }
    })
    scene.setMarkers(inputs)
  }, [scene, startups, filters, selectedBuilding, flash])

  // A refreshed building stops pulsing after its window.
  useEffect(() => {
    const times = Object.values(flash)
    if (!times.length) return
    const wait = Math.max(...times) - Date.now()
    if (wait <= 0) return
    const timer = setTimeout(() => useCity.setState({ flash: {} }), wait + 50)
    return () => clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    if (!scene) return
    if (!connectionsOn) { scene.setLinks([]); return }
    const byId = new Map(startups.map((s) => [s.id, s]))
    scene.setLinks(buildConnections(startups, suggestions.items)
      .filter((c) => kinds[c.kind] && (!connectionFocus || c.a === connectionFocus || c.b === connectionFocus))
      .map((c) => ({
        a: byId.get(c.a)!.location!.buildingId,
        b: byId.get(c.b)!.location!.buildingId,
        color: CONNECTION_KINDS[c.kind].color,
        dashed: CONNECTION_KINDS[c.kind].inferred,
        width: c.kind === 'industry' ? 1.4 : 2.2,
      })))
  }, [scene, startups, suggestions, connectionsOn, connectionFocus, kinds])
}

function SearchBar() {
  const query = useCity((s) => s.query)
  const search = useCity((s) => s.search)
  const filters = useCity((s) => s.filters)
  const { ask, clearSearch } = useCity.getState()
  const active = filtersActive(filters)
  return (
    <div className="sc-search-wrap">
      <form className="sc-search sc-glass" role="search" onSubmit={(event) => { event.preventDefault(); void ask(query) }}>
        {search.status === 'loading' ? <Loader2 size={17} className="sc-spin sc-cyan" /> : <Sparkles size={17} className="sc-cyan" />}
        <input
          id="sc-query" value={query} maxLength={240} autoComplete="off" spellCheck={false}
          onChange={(event) => useCity.setState({ query: event.target.value })}
          placeholder="Ask anything about Helsinki startups..." aria-label="Ask anything about Helsinki startups"
        />
        {(query || active) && <button type="button" className="sc-icon" onClick={clearSearch} aria-label="Clear search"><X size={15} /></button>}
        <button type="submit" className="sc-go" disabled={!query.trim() || search.status === 'loading'}><Search size={14} /> Ask</button>
      </form>
    </div>
  )
}

function SearchResult() {
  const search = useCity((s) => s.search)
  const filters = useCity((s) => s.filters)
  const startups = useCity((s) => s.startups)
  const route = useCity((s) => s.route)
  const { tourResults } = useCity.getState()
  const active = filtersActive(filters)
  const matches = useMemo(() => startups.filter((s) => s.industry !== 'hub' && matchesFilters(s, filters)), [startups, filters])
  const onMap = matches.filter((s) => s.location).length
  if (!active) return null
  return (
    <div className="sc-result sc-glass" role="status">
      <span>
        <b>{matches.length}</b> {matches.length === 1 ? 'company' : 'companies'} · {onMap} on the map
        {matches.length > onMap && <> · {matches.length - onMap} in the directory</>}
        {search.status === 'done' && (
          <small>{search.mode === 'gemini' ? `Interpreted by ${search.model}` : 'Keyword interpretation (Gemini unavailable)'} · matched only against sourced records</small>
        )}
      </span>
      {onMap > 1 && <button type="button" className="sc-btn small" onClick={tourResults}><RouteIcon size={12} /> {route && 'tour' in route ? `Route · ${(route.metres / 1000).toFixed(1)} km` : 'Route between results'}</button>}
    </div>
  )
}

function FilterChips() {
  const filters = useCity((s) => s.filters)
  const startups = useCity((s) => s.startups)
  const { toggleIndustry, toggleFlag } = useCity.getState()
  const used = industryIds.filter((id) => id !== 'hub' && startups.some((s) => s.industry === id))
  return (
    <div className="sc-chips sc-filter-row" role="group" aria-label="Filters">
      {used.map((id) => (
        <button key={id} type="button" title={INDUSTRIES[id].label} aria-pressed={filters.industries.includes(id)} style={{ ['--c' as string]: INDUSTRIES[id].color }} onClick={() => toggleIndustry(id as IndustryId)}>
          <i />{INDUSTRIES[id].short}
        </button>
      ))}
      <span className="sc-sep" />
      <button type="button" className="flag hiring" aria-pressed={filters.hiring} onClick={() => toggleFlag('hiring')}>Hiring</button>
      <button type="button" className="flag funded" aria-pressed={filters.recentlyFunded} onClick={() => toggleFlag('recentlyFunded')}>Funded</button>
      <button type="button" className="flag news" aria-pressed={filters.hasNews} onClick={() => toggleFlag('hasNews')}>In the news</button>
    </div>
  )
}

function Feed() {
  const startups = useCity((s) => s.startups)
  const freshNews = useCity((s) => s.freshNews)
  const dataMode = useCity((s) => s.dataMode)
  const meta = useCity((s) => s.meta)
  const items = useMemo(() => startups
    .flatMap((s) => s.news.map((n) => ({ n, s })))
    .sort((a, b) => Number(Boolean(freshNews[b.n.id])) - Number(Boolean(freshNews[a.n.id])) || Date.parse(b.n.publishedAt ?? '1970') - Date.parse(a.n.publishedAt ?? '1970'))
    .slice(0, 30), [startups, freshNews])
  const view = (s: Startup) => {
    const { select, scene, mode } = useCity.getState()
    select(s.location?.buildingId ?? null, s.id, s.location ? 'map' : null)
    if (s.location && mode === 'explorer') scene?.focusBuilding(s.location.buildingId)
  }
  return (
    <div className="sc-drawer-body">
      <p className="sc-note">
        {dataMode === 'live'
          ? <>Live · read through Context.dev {relativeDate(meta?.lastLiveAt ?? null)}</>
          : <>Cached snapshot · retrieved through Context.dev on {formatDate(meta?.snapshotAt)}. Press <b>Refresh startup signals</b> for a live reading.</>}
        {' '}Only published headlines appear here; nothing is simulated.
      </p>
      {items.length === 0 && <p className="sc-missing">No confidently matched headlines yet.</p>}
      <ul className="sc-feed">
        <AnimatePresence initial={false}>
          {items.map(({ n, s }) => (
            <motion.li key={n.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={freshNews[n.id] ? 'fresh' : ''}>
              <Logo startup={s} size={30} />
              <div>
                <span className="sc-feed-top"><b>{s.name}</b>{n.eventType !== 'other' && <i className={`sc-event ${n.eventType}`}>{n.eventType}</i>}{freshNews[n.id] && <i className="sc-event new">new</i>}</span>
                <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                <small>{n.sourceName} · {formatDate(n.publishedAt)}</small>
                {s.location
                  ? <button type="button" onClick={() => view(s)}><MapPin size={11} /> View on map</button>
                  : <button type="button" onClick={() => view(s)}><List size={11} /> Open profile · not on map</button>}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

function Missions() {
  const startups = useCity((s) => s.startups)
  const discovered = useCity((s) => s.discovered)
  const progress = missionProgress(startups, discovered)
  const collection = startups.filter((s) => discovered[s.id])
  const hint = (id: string) => {
    const store = useCity.getState()
    const mission = progress.find((m) => m.id === id)!
    const targets = placedOf(startups).filter((s) => s.industry !== 'hub' && mission.test(s) && !discovered[s.id])
    if (!targets.length) { store.notify('Every matching company on the map is already in your collection.'); return }
    if (id === 'ai') store.setFilters({ ...store.filters, industries: ['ai'], hiring: false, recentlyFunded: false, hasNews: false, keywords: [], roleKeywords: [] }, '')
    else store.setFilters({ industries: [], hiring: id === 'hiring', recentlyFunded: id === 'funded', hasNews: false, keywords: [], roleKeywords: [] }, '')
    useCity.setState({ search: { status: 'idle' } })
    if (store.mode === 'explorer') store.scene?.frameBounds(targets.map((s) => s.location!))
  }
  return (
    <div className="sc-drawer-body">
      <p className="sc-note">Visit a startup — click its building from above, or walk up and press <kbd>E</kbd> — to add it to your collection. Mission targets come from the same sourced records as the map.</p>
      <ul className="sc-missions">
        {progress.map((m, index) => (
          <li key={m.id} className={m.done ? 'done' : ''}>
            <span className="sc-mission-n">{m.done ? <Award size={15} /> : index + 1}</span>
            <div>
              <b>{m.title}</b>
              <small>{m.brief}</small>
              <span className="sc-bar"><i style={{ width: `${(m.count / MISSION_GOAL) * 100}%` }} /></span>
              <span className="sc-mission-foot">
                <em>{m.count} / {MISSION_GOAL}{m.done ? ' · +500 points' : ''}</em>
                {!m.done && <button type="button" onClick={() => hint(m.id)}><Target size={11} /> Show candidates</button>}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <h4>Badges</h4>
      <ul className="sc-badges-grid">
        {badges(startups, discovered).map((b) => <li key={b.name} className={b.earned ? 'earned' : ''} title={b.how}><Award size={14} />{b.name}</li>)}
      </ul>
      <h4>Startup collection · {collection.length}</h4>
      {collection.length === 0 ? <p className="sc-missing">Nothing discovered yet.</p> : (
        <ul className="sc-collection">
          {collection.map((s) => (
            <li key={s.id}><button type="button" title={s.name} onClick={() => { useCity.getState().select(s.location?.buildingId ?? null, s.id, null); useCity.getState().scene?.focusBuilding(s.location?.buildingId ?? '') }}><Logo startup={s} size={34} /></button></li>
          ))}
        </ul>
      )}
      {collection.length > 0 && <button type="button" className="sc-link" onClick={() => { try { localStorage.removeItem('startup-city-discoveries-v1') } catch { /* nothing stored */ } useCity.setState({ discovered: {} }) }}>Reset progress</button>}
    </div>
  )
}

function Directory() {
  const startups = useCity((s) => s.startups)
  const filters = useCity((s) => s.filters)
  const active = filtersActive(filters)
  const list = startups.filter((s) => s.industry !== 'hub' && (!active || matchesFilters(s, filters)))
  const row = (s: Startup) => (
    <li key={s.id}>
      <button type="button" onClick={() => { const store = useCity.getState(); store.select(s.location?.buildingId ?? null, s.id, s.location ? 'map' : null); if (s.location && store.mode === 'explorer') store.scene?.focusBuilding(s.location.buildingId) }}>
        <Logo startup={s} size={30} />
        <span><b>{s.name}</b><small>{INDUSTRIES[s.industry].label}{s.location ? ` · ${s.location.address}` : ''}</small></span>
        {isHiring(s) && <i className="sc-event hiring">hiring</i>}
      </button>
    </li>
  )
  const placed = list.filter((s) => s.location), unplaced = list.filter((s) => !s.location)
  return (
    <div className="sc-drawer-body">
      {active && <p className="sc-note">Showing companies that match the current search.</p>}
      <h4><MapPin size={12} /> On the map · {placed.length}</h4>
      <ul className="sc-directory">{placed.map(row)}</ul>
      <h4><Building2 size={12} /> Location not verified · {unplaced.length}</h4>
      <p className="sc-note">Helsinki companies whose reported address is outside the mapped district or could not be matched to a building. They are never placed on a guess.</p>
      <ul className="sc-directory">{unplaced.map(row)}</ul>
    </div>
  )
}

function ConnectionLegend() {
  const on = useCity((s) => s.connectionsOn)
  const focus = useCity((s) => s.connectionFocus)
  const kinds = useCity((s) => s.kinds)
  const startups = useCity((s) => s.startups)
  const suggestions = useCity((s) => s.suggestions)
  const suggesting = useCity((s) => s.suggesting)
  const gemini = useCity((s) => s.meta?.geminiAvailable)
  const all = useMemo(() => buildConnections(startups, suggestions.items), [startups, suggestions])
  if (!on) return null
  const scoped = all.filter((c) => !focus || c.a === focus || c.b === focus)
  const focusName = startups.find((s) => s.id === focus)?.name
  return (
    <motion.div className="sc-legend-card sc-glass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <header>
        <b><Network size={13} /> Connections{focusName ? ` · ${focusName}` : ''}</b>
        <button type="button" className="sc-icon" aria-label="Hide connections" onClick={() => useCity.setState({ connectionsOn: false, connectionFocus: null })}><X size={14} /></button>
      </header>
      {focus && <button type="button" className="sc-link" onClick={() => useCity.setState({ connectionFocus: null })}>Show the whole network</button>}
      <p className="sc-legend-title">From sourced records</p>
      {(Object.keys(CONNECTION_KINDS) as ConnectionKind[]).filter((k) => !CONNECTION_KINDS[k].inferred).map((k) => <KindToggle key={k} kind={k} on={kinds[k]} count={scoped.filter((c) => c.kind === k).length} />)}
      <p className="sc-legend-title">AI-inferred suggestions <em>not verified facts</em></p>
      {(Object.keys(CONNECTION_KINDS) as ConnectionKind[]).filter((k) => CONNECTION_KINDS[k].inferred).map((k) => <KindToggle key={k} kind={k} on={kinds[k]} count={scoped.filter((c) => c.kind === k).length} />)}
      <p className="sc-note">
        {suggestions.generatedAt ? `Suggested by ${suggestions.model} on ${formatDate(suggestions.generatedAt)}.` : 'No suggestions generated yet.'}
        {gemini && <button type="button" className="sc-link" disabled={suggesting} onClick={() => void useCity.getState().suggestConnections()}>{suggesting ? 'Asking Gemini…' : suggestions.generatedAt ? 'Regenerate' : 'Suggest with Gemini'}</button>}
      </p>
    </motion.div>
  )
}

function KindToggle({ kind, on, count }: { kind: ConnectionKind; on: boolean; count: number }) {
  const info = CONNECTION_KINDS[kind]
  return (
    <label className="sc-kind" title={info.hint}>
      <input type="checkbox" checked={on} onChange={() => useCity.setState({ kinds: { ...useCity.getState().kinds, [kind]: !on } })} />
      <i className={info.inferred ? 'dashed' : ''} style={{ ['--c' as string]: info.color }} />
      <span>{info.label}</span><em>{count}</em>
    </label>
  )
}

// ───────────────────────────────────────────── guided demo

const STEP_SECONDS = 10
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function demoTarget() {
  const { startups } = useCity.getState()
  const rank = (s: Startup) => (s.news.some((n) => n.eventType === 'funding') ? 8 : 0) + (s.news.length ? 4 : 0) + (recentFunding(s) ? 2 : 0) + (isHiring(s) ? 1 : 0)
  return placedOf(startups).filter((s) => s.industry === 'ai').sort((a, b) => rank(b) - rank(a))[0] ?? placedOf(startups).find((s) => s.industry !== 'hub')
}

const DEMO_STEPS: { title: string; text: () => string; run: () => void | Promise<void> }[] = [
  {
    title: 'Helsinki, as a living 3D world',
    text: () => 'Every building, street, park and shoreline comes from OpenStreetMap at its real coordinates, under live northern lights.',
    run: () => {
      const store = useCity.getState()
      store.clearSearch()
      store.select(null)
      useCity.setState({ connectionsOn: false, connectionFocus: null, panel: null })
      store.scene?.enterExplorer()
      store.scene?.flyHome()
    },
  },
  {
    title: 'Ask in plain language',
    text: () => '“Show me AI startups in Helsinki.” Gemini turns the question into structured map filters.',
    run: async () => {
      const question = 'Show me AI startups in Helsinki'
      for (let i = 1; i <= question.length; i++) {
        if (!useCity.getState().demo.active) return
        useCity.setState({ query: question.slice(0, i) })
        await wait(38)
      }
      await useCity.getState().ask(question)
    },
  },
  {
    title: 'Matching buildings light up',
    text: () => {
      const { startups, filters } = useCity.getState()
      const n = placedOf(startups).filter((s) => matchesFilters(s, filters)).length
      return `${n} AI companies glow at their verified addresses. A route links them along real streets.`
    },
    run: () => {
      const store = useCity.getState()
      if (!filtersActive(store.filters)) store.setFilters({ ...store.filters, industries: ['ai'] })
      const matches = placedOf(useCity.getState().startups).filter((s) => matchesFilters(s, useCity.getState().filters))
      store.scene?.frameBounds(matches.map((s) => s.location!))
      store.tourResults()
    },
  },
  {
    title: 'Fly to a startup building',
    text: () => { const t = demoTarget(); return t ? `${t.name} · ${t.location!.address}. The address comes from the company profile and is matched to a mapped building.` : '' },
    run: () => { const t = demoTarget(); if (t) useCity.getState().scene?.focusBuilding(t.location!.buildingId, 280) },
  },
  {
    title: 'Open the company profile',
    text: () => 'Each fact shows where it came from: verified, sourced, or AI-generated. Missing facts stay empty.',
    run: () => { const t = demoTarget(); if (t) useCity.getState().select(t.location!.buildingId, t.id) },
  },
  {
    title: 'Retrieve fresh signals with Context.dev',
    text: () => {
      const refresh = useCity.getState().refresh
      return refresh.status === 'error' ? `${refresh.message} The demo continues on cached, labelled data.` : 'Context.dev re-reads the company’s news coverage and careers page right now.'
    },
    run: async () => { const t = demoTarget(); if (t) await useCity.getState().refreshSignals([t.id]) },
  },
  {
    title: 'Real announcements move the city',
    text: () => {
      const t = demoTarget()
      const fresh = t && useCity.getState().startups.find((s) => s.id === t.id)
      const item = fresh?.news.find((n) => n.eventType !== 'other') ?? fresh?.news[0]
      return item ? `“${item.title}” — ${item.sourceName}, ${formatDate(item.publishedAt)}. The building pulses; funding news turns it gold.` : `No confidently matched headline for ${t?.name ?? 'this company'} right now, so nothing is shown. Events are never simulated.`
    },
    run: () => {
      const t = demoTarget()
      if (!t) return
      useCity.setState({ flash: { ...useCity.getState().flash, [t.location!.buildingId]: Date.now() + 12_000 }, panel: 'feed' })
    },
  },
  {
    title: 'See how startups connect',
    text: () => 'Solid lines come from sourced records: shared investors, joint announcements, same industry. Dashed lines are Gemini suggestions, labelled as such.',
    run: () => {
      const t = demoTarget()
      const store = useCity.getState()
      useCity.setState({ panel: null })
      store.scene?.setRoutes([])
      useCity.setState({ route: null, connectionsOn: true, connectionFocus: null })
      store.select(null)
      store.setFilters({ industries: [], hiring: false, recentlyFunded: false, hasNews: false, keywords: [], roleKeywords: [] }, '')
      useCity.setState({ search: { status: 'idle' } })
      void t
      store.scene?.flyTo({ tx: -330, tz: 230, dist: 1750, pitch: 0.82, yaw: 0.1 })
    },
  },
  {
    title: 'Start a discovery mission',
    text: () => 'Find 3 AI startups, 3 that are hiring and 3 recently funded. Explore from above, or walk the streets and press E.',
    run: () => {
      const store = useCity.getState()
      useCity.setState({ connectionsOn: false, connectionFocus: null, panel: 'missions' })
      store.clearSearch()
      store.scene?.flyHome()
    },
  },
]

async function startDemo() {
  const store = useCity.getState()
  if (!store.scene) return
  if (!store.scene.entered) {
    document.getElementById('enter')?.click()
    for (let i = 0; i < 200 && useCity.getState().mode !== 'explorer'; i++) await wait(100)
  } else if (useCity.getState().mode !== 'explorer') store.scene.enterExplorer()
  useCity.setState({ demo: { active: true, step: 0, paused: false } })
}

function DemoBar() {
  const demo = useCity((s) => s.demo)
  const refresh = useCity((s) => s.refresh)
  const startups = useCity((s) => s.startups)
  const filters = useCity((s) => s.filters)
  const [elapsed, setElapsed] = useState(0)
  const go = (step: number) => { setElapsed(0); useCity.setState({ demo: { active: true, step: Math.max(0, Math.min(DEMO_STEPS.length - 1, step)), paused: useCity.getState().demo.paused } }) }

  useEffect(() => {
    if (!demo.active) return
    setElapsed(0)
    void DEMO_STEPS[demo.step].run()
  }, [demo.active, demo.step])

  useEffect(() => {
    if (!demo.active || demo.paused) return
    const timer = setInterval(() => setElapsed((value) => value + 0.1), 100)
    return () => clearInterval(timer)
  }, [demo.active, demo.paused, demo.step])

  useEffect(() => {
    if (demo.active && !demo.paused && elapsed >= STEP_SECONDS && demo.step < DEMO_STEPS.length - 1) go(demo.step + 1)
  }, [elapsed, demo])

  if (!demo.active) return null
  const step = DEMO_STEPS[demo.step]
  // Re-read the caption when the data it describes changes.
  void refresh; void startups; void filters
  return (
    <motion.div className="sc-demo sc-glass" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} role="region" aria-label="Guided demo">
      <span className="sc-demo-progress"><i style={{ width: `${Math.min(100, ((demo.step + Math.min(elapsed / STEP_SECONDS, 1)) / DEMO_STEPS.length) * 100)}%` }} /></span>
      <div className="sc-demo-text">
        <small>Step {demo.step + 1} of {DEMO_STEPS.length} · {Math.max(0, Math.round((DEMO_STEPS.length - demo.step) * STEP_SECONDS - Math.min(elapsed, STEP_SECONDS)))} s left</small>
        <b>{step.title}</b>
        <p>{step.text()}</p>
      </div>
      <div className="sc-demo-controls">
        <button type="button" onClick={() => go(demo.step - 1)} disabled={demo.step === 0} aria-label="Previous step"><ChevronLeft size={16} /><span>Previous</span></button>
        <button type="button" onClick={() => useCity.setState({ demo: { ...demo, paused: !demo.paused } })} aria-label={demo.paused ? 'Resume' : 'Pause'}>{demo.paused ? <Play size={15} /> : <Pause size={15} />}<span>{demo.paused ? 'Resume' : 'Pause'}</span></button>
        <button type="button" onClick={() => go(demo.step + 1)} disabled={demo.step === DEMO_STEPS.length - 1} aria-label="Next step"><span>Next</span><ChevronRight size={16} /></button>
        <button type="button" onClick={() => go(0)} aria-label="Restart demo"><RotateCcw size={14} /><span>Restart</span></button>
        <button type="button" onClick={() => useCity.setState({ demo: { active: false, step: 0, paused: false } })} aria-label="End demo"><X size={15} /></button>
      </div>
    </motion.div>
  )
}

// ───────────────────────────────────────────── shell

export function App() {
  useSceneSync()
  const loaded = useCity((s) => s.loaded)
  const loadError = useCity((s) => s.loadError)
  const scene = useCity((s) => s.scene)
  const mode = useCity((s) => s.mode)
  const panel = useCity((s) => s.panel)
  const refresh = useCity((s) => s.refresh)
  const dataMode = useCity((s) => s.dataMode)
  const meta = useCity((s) => s.meta)
  const startups = useCity((s) => s.startups)
  const discovered = useCity((s) => s.discovered)
  const connectionsOn = useCity((s) => s.connectionsOn)
  const near = useCity((s) => s.near)
  const selectedId = useCity((s) => s.selectedId)
  const route = useCity((s) => s.route)
  const toast = useCity((s) => s.toast)
  const demo = useCity((s) => s.demo)
  const { setMode, refreshSignals, toggleConnections, select } = useCity.getState()
  const rootRef = useRef<HTMLDivElement>(null)
  const points = score(startups, discovered)
  const nearCompanies = near ? startups.filter((s) => s.location?.buildingId === near) : []
  const togglePanel = (name: 'feed' | 'missions' | 'directory') => useCity.setState({ panel: panel === name ? null : name })
  const newsCount = useMemo(() => startups.reduce((n, s) => n + s.news.length, 0), [startups])
  const missionsDone = missionProgress(startups, discovered).filter((m) => m.done).length

  // The game engine listens for keys on window; typing in our fields must not steer the scooter.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const stop = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) event.stopPropagation()
    }
    root.addEventListener('keydown', stop)
    root.addEventListener('keyup', stop)
    return () => { root.removeEventListener('keydown', stop); root.removeEventListener('keyup', stop) }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = useCity.getState()
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea')
      if (!state.scene?.entered || event.repeat) return
      if (event.code === 'Escape') {
        if (typing) { (event.target as HTMLElement).blur(); event.stopImmediatePropagation(); return }
        if (state.selectedId) { state.select(null); event.stopImmediatePropagation() }
        else if (state.panel) { useCity.setState({ panel: null }); event.stopImmediatePropagation() }
        else if (state.demo.active) { useCity.setState({ demo: { active: false, step: 0, paused: false } }); event.stopImmediatePropagation() }
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.code === 'KeyE' && state.mode === 'street' && state.near) {
        state.select(state.near, null, 'street')
        event.stopImmediatePropagation()
      } else if (event.code === 'Tab') {
        event.preventDefault()
        state.setMode(state.mode === 'explorer' ? 'street' : 'explorer')
      } else if (event.code === 'Slash') {
        event.preventDefault()
        document.getElementById('sc-query')?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    const titleDemo = document.getElementById('sc-title-demo')
    const begin = () => void startDemo()
    titleDemo?.addEventListener('click', begin)
    return () => { window.removeEventListener('keydown', onKey, true); titleDemo?.removeEventListener('click', begin) }
  }, [])

  // While walking a route, keep it anchored to the rider and notice arrival.
  useEffect(() => {
    if (mode !== 'street' || !route || !('targetId' in route) || !scene) return
    const timer = setInterval(() => {
      const state = useCity.getState()
      const target = state.startups.find((s) => s.id === (route as { targetId: string }).targetId)?.location
      if (!target) return
      const here = scene.playerPosition()
      if (Math.hypot(here.x - target.x, here.z - target.z) < 30) {
        state.navigateTo(null)
        state.notify('You have arrived. Press E to visit.', 'green')
      } else state.navigateTo((route as { targetId: string }).targetId)
    }, 1500)
    return () => clearInterval(timer)
  }, [mode, route && 'targetId' in route ? route.targetId : null, scene])

  return (
    <div id="sc-root" ref={rootRef} data-mode={mode} data-panel-open={selectedId ? 'true' : 'false'}>
      <header className="sc-top">
        <div className="sc-brand sc-glass">
          <strong>STARTUP CITY</strong><span>HELSINKI</span>
          <em className={dataMode} title={dataMode === 'live' ? `Read through Context.dev ${formatDate(meta?.lastLiveAt)}` : `Snapshot retrieved through Context.dev on ${formatDate(meta?.snapshotAt)}`}>
            <i />{dataMode === 'live' ? 'LIVE · Context.dev' : `CACHED · ${formatDate(meta?.snapshotAt)}`}
          </em>
        </div>
        <SearchBar />
        <nav className="sc-tools sc-glass" aria-label="City tools">
          <div className="sc-mode" role="group" aria-label="Camera mode">
            <button type="button" aria-pressed={mode === 'explorer'} onClick={() => setMode('explorer')} title="City Explorer · bird's-eye view (Tab)"><Compass size={14} /> City</button>
            <button type="button" aria-pressed={mode === 'street'} onClick={() => setMode('street')} title="Street Explorer · ride and walk (Tab)"><Footprints size={14} /> Street</button>
          </div>
          <button type="button" className="sc-refresh" disabled={refresh.status === 'loading'} onClick={() => void refreshSignals()}>
            {refresh.status === 'loading' ? <Loader2 size={14} className="sc-spin" /> : <RefreshCw size={14} />} REFRESH STARTUP SIGNALS
          </button>
          <button type="button" aria-pressed={connectionsOn} onClick={() => toggleConnections()} title="Startup connections"><Network size={14} /> Connections</button>
          <button type="button" className="sc-demo-start" onClick={() => void startDemo()} disabled={demo.active}><Play size={13} /> START DEMO</button>
        </nav>
        <FilterChips />
        <SearchResult />
      </header>

      <AnimatePresence>
        {refresh.status !== 'idle' && (
          <motion.div key={refresh.status} className={`sc-refresh-status sc-glass ${refresh.status}`} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {refresh.status === 'loading' && <><Loader2 size={14} className="sc-spin" /> Context.dev is reading news and careers pages for {refresh.scope}…</>}
            {refresh.status === 'success' && <><Radio size={14} /> {refresh.message} <small>{new Date(refresh.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></>}
            {refresh.status === 'error' && <><Radio size={14} /> {refresh.message} <small>Cached data · {formatDate(meta?.snapshotAt)}</small></>}
            {refresh.status !== 'loading' && <button type="button" className="sc-icon" aria-label="Dismiss" onClick={() => useCity.setState({ refresh: { status: 'idle' } })}><X size={13} /></button>}
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="sc-rail" aria-label="City panels">
        <div className="sc-rail-tabs sc-glass">
          <button type="button" aria-pressed={panel === 'feed'} onClick={() => togglePanel('feed')}><Newspaper size={15} /><span>LIVE FROM HELSINKI</span><em>{newsCount}</em></button>
          <button type="button" aria-pressed={panel === 'missions'} onClick={() => togglePanel('missions')}><Target size={15} /><span>Missions</span><em>{missionsDone}/3 · {points} pts</em></button>
          <button type="button" aria-pressed={panel === 'directory'} onClick={() => togglePanel('directory')}><List size={15} /><span>Directory</span><em>{startups.filter((s) => s.industry !== 'hub').length}</em></button>
        </div>
        <AnimatePresence mode="wait">
          {panel && (
            <motion.section key={panel} className="sc-drawer sc-glass" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
              <header>
                <h2>{panel === 'feed' ? <><i className="sc-live-dot" />LIVE FROM HELSINKI</> : panel === 'missions' ? 'Discovery missions' : 'Startup directory'}</h2>
                <button type="button" className="sc-icon" aria-label="Close" onClick={() => useCity.setState({ panel: null })}><X size={15} /></button>
              </header>
              {panel === 'feed' ? <Feed /> : panel === 'missions' ? <Missions /> : <Directory />}
            </motion.section>
          )}
        </AnimatePresence>
      </aside>

      <Panel />
      <ConnectionLegend />

      <div className="sc-bottom">
        {mode === 'street' && nearCompanies.length > 0 && !selectedId && (
          <motion.button type="button" className="sc-near sc-glass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => select(near, null, 'street')}>
            <kbd>E</kbd> Visit {nearCompanies.find((s) => s.industry === 'hub')?.name ?? nearCompanies[0].name}{nearCompanies.length > 1 ? ` · ${nearCompanies.length} companies` : ''}
          </motion.button>
        )}
        {mode === 'explorer' && !demo.active && <p className="sc-help">Drag to pan · right-drag or Shift-drag to rotate · scroll to zoom · click a glowing building · <kbd>Tab</kbd> street level</p>}
        {mode === 'street' && !demo.active && <p className="sc-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ride · <kbd>F</kbd> walk · drag to look · <kbd>E</kbd> visit a startup · <kbd>Tab</kbd> city view</p>}
        <DemoBar />
      </div>

      <AnimatePresence>
        {toast && <motion.div key={toast.id} className={`sc-toast sc-glass ${toast.tone}`} role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{toast.text}</motion.div>}
      </AnimatePresence>
      {loaded && loadError && <div className="sc-load-error sc-glass" role="alert">{loadError}</div>}
      <a className="sc-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Map © OpenStreetMap contributors · company data via Context.dev</a>
    </div>
  )
}
