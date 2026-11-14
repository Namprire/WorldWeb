import { AnimatePresence, motion } from 'framer-motion'
import {
  Award, Check, ChevronLeft, ChevronRight, Clapperboard, Compass, Footprints, List, Loader2, MapPin, Network, Newspaper, Pause, Play,
  RefreshCw, RotateCcw, Route as RouteIcon, Sparkles, Target, X,
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
import { Clock } from './Clock'
import { CutscenePlayer } from './Cutscene'
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
        subtitle: hub ? `${companies.length} startups on campus` : members.length > 1 ? `${members.length} companies` : INDUSTRIES[lead.industry].label,
        color: INDUSTRIES[lead.industry].color,
        logos: (hub ? [hub, ...shown] : shown).map((s) => ({ src: s.logo, initials: initials(s.name), dark: Boolean(s.logoOnDark) })),
        count: hub ? shown.length + 1 : shown.length,
        hiring: shown.some(isHiring),
        funded: shown.some((s) => recentFunding(s)),
        news: shown.some((s) => recentNews(s).length > 0),
        launch: shown.some((s) => recentNews(s).some((n) => n.eventType === 'launch')),
        state: selectedBuilding === buildingId ? 'selected' : (flash[buildingId] ?? 0) > now ? 'flash' : active ? (matching.length ? 'match' : 'dim') : 'normal',
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
    <form className="sc-search sc-glass" role="search" onSubmit={(event) => { event.preventDefault(); void ask(query) }}>
      {search.status === 'loading' ? <Loader2 size={18} className="sc-spin sc-ai-icon" /> : <Sparkles size={18} className="sc-ai-icon" />}
      <input
        id="sc-query" value={query} maxLength={240} autoComplete="off" spellCheck={false}
        onChange={(event) => useCity.setState({ query: event.target.value })}
        placeholder="Ask anything about Helsinki startups..." aria-label="Ask anything about Helsinki startups"
      />
      {(query || active) && <button type="button" className="sc-icon" onClick={clearSearch} aria-label="Clear search"><X size={16} /></button>}
      <button type="submit" className="sc-go" disabled={!query.trim() || search.status === 'loading'}>Ask</button>
    </form>
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
  const others = matches.length - onMap
  return (
    <div className="sc-result sc-glass" role="status">
      <p>
        <b>{matches.length} {matches.length === 1 ? 'company' : 'companies'}</b>, {onMap} on the map{others > 0 && `, ${others} in the directory`}.
        {search.status === 'done' && (
          <span className="sc-muted"> {search.mode === 'gemini' ? `Read by ${search.model}.` : 'Gemini was unavailable, so keywords were used.'} Only sourced records are matched.</span>
        )}
      </p>
      {onMap > 1 && (
        <button type="button" className="sc-text-btn" onClick={tourResults}>
          <RouteIcon size={15} /> {route && 'tour' in route ? `Route, ${(route.metres / 1000).toFixed(1)} km` : 'Route between them'}
        </button>
      )}
    </div>
  )
}

function Filters() {
  const filters = useCity((s) => s.filters)
  const startups = useCity((s) => s.startups)
  const { toggleIndustry, toggleFlag } = useCity.getState()
  const used = industryIds.filter((id) => id !== 'hub' && startups.some((s) => s.industry === id && s.location))
  return (
    <div className="sc-filters" role="group" aria-label="Filters">
      {used.map((id) => (
        <button key={id} type="button" title={INDUSTRIES[id].label} aria-pressed={filters.industries.includes(id)} style={{ ['--c' as string]: INDUSTRIES[id].color }} onClick={() => toggleIndustry(id as IndustryId)}>
          <i />{INDUSTRIES[id].short}
        </button>
      ))}
      <span className="sc-sep" aria-hidden="true" />
      <button type="button" aria-pressed={filters.hiring} style={{ ['--c' as string]: 'var(--sc-hiring)' }} onClick={() => toggleFlag('hiring')}><i />Hiring</button>
      <button type="button" aria-pressed={filters.recentlyFunded} style={{ ['--c' as string]: 'var(--sc-funded)' }} onClick={() => toggleFlag('recentlyFunded')}><i />Recently funded</button>
      <button type="button" aria-pressed={filters.hasNews} style={{ ['--c' as string]: 'var(--sc-news)' }} onClick={() => toggleFlag('hasNews')}><i />In the news</button>
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
      <p className="sc-muted">
        {dataMode === 'live'
          ? `Read through Context.dev ${relativeDate(meta?.lastLiveAt ?? null)}.`
          : `Saved copy from ${formatDate(meta?.snapshotAt)}. Refresh startup signals for a new reading.`}
        {' '}Only published headlines appear here.
      </p>
      {items.length === 0 && <p className="sc-missing">No headlines matched with confidence yet.</p>}
      <ul className="sc-feed">
        <AnimatePresence initial={false}>
          {items.map(({ n, s }) => (
            <motion.li key={n.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={freshNews[n.id] ? 'fresh' : ''}>
              <Logo startup={s} size={32} />
              <div>
                <p className="sc-feed-meta">
                  <b>{s.name}</b>
                  {n.eventType !== 'other' && <span className={`sc-event ${n.eventType}`}>{EVENT_LABEL[n.eventType]}</span>}
                  {freshNews[n.id] && <span className="sc-event new">New</span>}
                </p>
                <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                <p className="sc-muted">{n.sourceName}, {formatDate(n.publishedAt)}</p>
                <div className="sc-row-actions">
                  <button type="button" className="sc-text-btn" onClick={() => view(s)}>{s.location ? <><MapPin size={14} /> View on map</> : <><List size={14} /> Open profile</>}</button>
                  {s.location && <button type="button" className="sc-text-btn" onClick={() => useCity.getState().playCutscene({ kind: 'signal', id: n.id })}><Clapperboard size={14} /> Watch</button>}
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

const EVENT_LABEL = { funding: 'Funding', hiring: 'Hiring', launch: 'Launch', partnership: 'Partnership', other: '' } as const

function Missions() {
  const startups = useCity((s) => s.startups)
  const discovered = useCity((s) => s.discovered)
  const progress = missionProgress(startups, discovered)
  const collection = startups.filter((s) => discovered[s.id])
  const points = score(startups, discovered)
  const hint = (id: string) => {
    const store = useCity.getState()
    const mission = progress.find((m) => m.id === id)!
    const targets = placedOf(startups).filter((s) => s.industry !== 'hub' && mission.test(s) && !discovered[s.id])
    if (!targets.length) { store.notify('You have already found every matching company on the map.'); return }
    store.setFilters({ industries: id === 'ai' ? ['ai'] : [], hiring: id === 'hiring', recentlyFunded: id === 'funded', hasNews: false, keywords: [], roleKeywords: [] }, '')
    useCity.setState({ search: { status: 'idle' } })
    if (store.mode === 'explorer') store.scene?.frameBounds(targets.map((s) => s.location!))
  }
  return (
    <div className="sc-drawer-body">
      <p className="sc-muted">Visit a startup to add it to your collection: click its building from above, or walk up to it and press <kbd>E</kbd>. You have {points} points.</p>
      <ul className="sc-missions">
        {progress.map((m) => (
          <li key={m.id} className={m.done ? 'done' : ''}>
            <h3>{m.done && <Check size={16} />} {m.title}</h3>
            <p className="sc-muted">{m.brief}</p>
            <div className="sc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={MISSION_GOAL} aria-valuenow={m.count}><i style={{ width: `${(m.count / MISSION_GOAL) * 100}%` }} /></div>
            <div className="sc-row-actions">
              <span>{m.count} of {MISSION_GOAL}{m.done ? ', 500 points earned' : ''}</span>
              {!m.done && <button type="button" className="sc-text-btn" onClick={() => hint(m.id)}><Target size={14} /> Show candidates</button>}
            </div>
          </li>
        ))}
      </ul>
      <h3 className="sc-subhead">Badges</h3>
      <ul className="sc-badges-grid">
        {badges(startups, discovered).map((b) => <li key={b.name} className={b.earned ? 'earned' : ''} title={b.how}><Award size={16} />{b.name}</li>)}
      </ul>
      <h3 className="sc-subhead">Your collection ({collection.length})</h3>
      {collection.length === 0 ? <p className="sc-missing">Nothing found yet.</p> : (
        <ul className="sc-collection">
          {collection.map((s) => (
            <li key={s.id}><button type="button" title={s.name} onClick={() => { useCity.getState().select(s.location?.buildingId ?? null, s.id, null); useCity.getState().scene?.focusBuilding(s.location?.buildingId ?? '') }}><Logo startup={s} size={36} /></button></li>
          ))}
        </ul>
      )}
      {collection.length > 0 && <button type="button" className="sc-text-btn" onClick={() => { try { localStorage.removeItem('startup-city-discoveries-v1') } catch { /* nothing stored */ } useCity.setState({ discovered: {} }) }}>Reset progress</button>}
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
        <Logo startup={s} size={32} />
        <span>
          <b>{s.name}</b>
          <span className="sc-muted">{s.location ? s.location.address : s.outsideDistrict && s.reportedAddress ? `${s.reportedAddress}, ${s.municipality}` : INDUSTRIES[s.industry].label}</span>
        </span>
        {isHiring(s) && <span className="sc-event hiring">Hiring</span>}
      </button>
    </li>
  )
  const placed = list.filter((s) => s.location)
  const outside = list.filter((s) => !s.location && s.outsideDistrict)
  const unknown = list.filter((s) => !s.location && !s.outsideDistrict)
  return (
    <div className="sc-drawer-body">
      {active && <p className="sc-muted">Showing companies that match your search.</p>}
      <h3 className="sc-subhead">On the map ({placed.length})</h3>
      <ul className="sc-directory">{placed.map(row)}</ul>
      {outside.length > 0 && <>
        <h3 className="sc-subhead">Outside the 3D district ({outside.length})</h3>
        <p className="sc-muted">The address is confirmed in the Helsinki region address register, but the building is beyond the modelled area.</p>
        <ul className="sc-directory">{outside.map(row)}</ul>
      </>}
      {unknown.length > 0 && <>
        <h3 className="sc-subhead">Address not confirmed ({unknown.length})</h3>
        <p className="sc-muted">No address could be matched to a building, so these companies are not placed on the map.</p>
        <ul className="sc-directory">{unknown.map(row)}</ul>
      </>}
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
    <motion.section className="sc-legend-card sc-glass" aria-label="Connections" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <header>
        <h2>{focusName ? `${focusName}'s connections` : 'Connections'}</h2>
        <button type="button" className="sc-icon" aria-label="Hide connections" onClick={() => useCity.setState({ connectionsOn: false, connectionFocus: null })}><X size={16} /></button>
      </header>
      {focus && <button type="button" className="sc-text-btn" onClick={() => useCity.setState({ connectionFocus: null })}>Show the whole network</button>}
      <h3>From the records</h3>
      {(Object.keys(CONNECTION_KINDS) as ConnectionKind[]).filter((k) => !CONNECTION_KINDS[k].inferred).map((k) => <KindToggle key={k} kind={k} on={kinds[k]} count={scoped.filter((c) => c.kind === k).length} />)}
      <h3 className="sc-ai-text">Suggested by Gemini</h3>
      <p className="sc-muted">Ideas, not verified facts.</p>
      {(Object.keys(CONNECTION_KINDS) as ConnectionKind[]).filter((k) => CONNECTION_KINDS[k].inferred).map((k) => <KindToggle key={k} kind={k} on={kinds[k]} count={scoped.filter((c) => c.kind === k).length} />)}
      <p className="sc-muted">
        {suggestions.generatedAt ? `Generated by ${suggestions.model} on ${formatDate(suggestions.generatedAt)}.` : 'Nothing suggested yet.'}
        {gemini && <> <button type="button" className="sc-text-btn" disabled={suggesting} onClick={() => void useCity.getState().suggestConnections()}>{suggesting ? 'Asking Gemini' : suggestions.generatedAt ? 'Regenerate' : 'Suggest with Gemini'}</button></>}
      </p>
    </motion.section>
  )
}

function KindToggle({ kind, on, count }: { kind: ConnectionKind; on: boolean; count: number }) {
  const info = CONNECTION_KINDS[kind]
  return (
    <label className="sc-kind" title={info.hint}>
      <input type="checkbox" role="switch" checked={on} onChange={() => useCity.setState({ kinds: { ...useCity.getState().kinds, [kind]: !on } })} />
      <i className={info.inferred ? 'dashed' : ''} style={{ ['--c' as string]: info.color }} />
      <span>{info.label}</span><span className="sc-muted">{count}</span>
    </label>
  )
}

// Guided demo

const STEP_SECONDS = 10
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function demoTarget() {
  const { startups } = useCity.getState()
  const rank = (s: Startup) => (s.news.some((n) => n.eventType === 'funding') ? 8 : 0) + (s.news.length ? 4 : 0) + (recentFunding(s) ? 2 : 0) + (isHiring(s) ? 1 : 0)
  return placedOf(startups).filter((s) => s.industry === 'ai').sort((a, b) => rank(b) - rank(a))[0] ?? placedOf(startups).find((s) => s.industry !== 'hub')
}

const DEMO_STEPS: { title: string; text: () => string; run: () => void | Promise<void> }[] = [
  {
    title: 'Helsinki in 3D',
    text: () => 'Every building, street, park and shoreline comes from OpenStreetMap at its real coordinates.',
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
    text: () => 'Type a question. Gemini turns it into filters for the map.',
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
      return `${n} AI companies light up at their registered addresses, and a route links them along real streets.`
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
    text: () => { const t = demoTarget(); return t ? `${t.name}, ${t.location!.address}. The address is matched to a mapped building before anything is placed.` : '' },
    run: () => { const t = demoTarget(); if (t) useCity.getState().scene?.focusBuilding(t.location!.buildingId, 280) },
  },
  {
    title: 'Open the company profile',
    text: () => 'Each fact links to where it came from. Facts nobody has published stay empty.',
    run: () => { const t = demoTarget(); if (t) useCity.getState().select(t.location!.buildingId, t.id) },
  },
  {
    title: 'Retrieve fresh signals with Context.dev',
    text: () => {
      const refresh = useCity.getState().refresh
      return refresh.status === 'error' ? `${refresh.message} The demo carries on with the saved copy.` : 'Context.dev reads the company\'s news coverage and careers page again, now.'
    },
    run: async () => { const t = demoTarget(); if (t) await useCity.getState().refreshSignals([t.id]) },
  },
  {
    title: 'News becomes a cutscene',
    text: () => {
      const t = demoTarget()
      const fresh = t && useCity.getState().startups.find((s) => s.id === t.id)
      const item = fresh?.news.find((n) => n.eventType !== 'other') ?? fresh?.news[0]
      return item
        ? `${item.sourceName} reported "${item.title}". Gemini writes and voices a short scene from that headline and the company record.`
        : `Gemini writes and voices a short scene about ${t?.name ?? 'this company'} from its record.`
    },
    run: () => {
      const t = demoTarget()
      if (!t) return
      const fresh = useCity.getState().startups.find((s) => s.id === t.id)
      const item = fresh?.news.find((n) => n.eventType !== 'other') ?? fresh?.news[0]
      useCity.setState({ flash: { ...useCity.getState().flash, [t.location!.buildingId]: Date.now() + 12_000 } })
      useCity.getState().playCutscene(item ? { kind: 'signal', id: item.id } : { kind: 'company', id: t.id })
    },
  },
  {
    title: 'See how startups connect',
    text: () => 'Solid lines come from the records: shared investors, joint announcements, same industry. Dashed lines are Gemini suggestions.',
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

  const cinema = useCity((s) => Boolean(s.cutscene))
  useEffect(() => {
    if (!demo.active || demo.paused || cinema) return
    const timer = setInterval(() => setElapsed((value) => value + 0.1), 100)
    return () => clearInterval(timer)
  }, [demo.active, demo.paused, demo.step, cinema])

  useEffect(() => {
    if (demo.active && !demo.paused && elapsed >= STEP_SECONDS && demo.step < DEMO_STEPS.length - 1) go(demo.step + 1)
  }, [elapsed, demo])

  if (!demo.active) return null
  const step = DEMO_STEPS[demo.step]
  // Re-read the caption when the data it describes changes.
  void refresh; void startups; void filters
  return (
    <motion.div className="sc-demo sc-glass" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} role="region" aria-label="Guided demo">
      <span className="sc-demo-progress" aria-hidden="true"><i style={{ width: `${Math.min(100, ((demo.step + Math.min(elapsed / STEP_SECONDS, 1)) / DEMO_STEPS.length) * 100)}%` }} /></span>
      <div className="sc-demo-text">
        <h2><span className="sc-muted">{demo.step + 1} of {DEMO_STEPS.length}</span> {step.title}</h2>
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

// Shell

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
  const { setMode, refreshSignals, toggleConnections, select, playCutscene } = useCity.getState()
  const rootRef = useRef<HTMLDivElement>(null)
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
      if (!state.scene?.entered || event.repeat || state.cutscene) return
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
        state.notify('You have arrived. Press E to go in.', 'green')
      } else state.navigateTo((route as { targetId: string }).targetId)
    }, 1500)
    return () => clearInterval(timer)
  }, [mode, route && 'targetId' in route ? route.targetId : null, scene])

  return (
    <div id="sc-root" ref={rootRef} data-mode={mode} data-panel-open={selectedId ? 'true' : 'false'}>
      <header className="sc-top">
        <div className="sc-brand">
          <p className="sc-wordmark">Startup City <span>Helsinki</span></p>
          <p className="sc-muted" title={dataMode === 'live' ? `Read through Context.dev ${formatDate(meta?.lastLiveAt)}` : `Saved copy retrieved through Context.dev on ${formatDate(meta?.snapshotAt)}`}>
            {dataMode === 'live' ? `Live data, read ${relativeDate(meta?.lastLiveAt ?? null)}` : `Saved data from ${formatDate(meta?.snapshotAt)}`}
          </p>
        </div>
        <SearchBar />
        <nav className="sc-tools" aria-label="City tools">
          <div className="sc-segmented sc-glass" role="radiogroup" aria-label="Camera mode">
            <button type="button" role="radio" aria-checked={mode === 'explorer'} onClick={() => setMode('explorer')} title="Bird's-eye view (Tab)"><Compass size={16} /> City</button>
            <button type="button" role="radio" aria-checked={mode === 'street'} onClick={() => setMode('street')} title="Ride and walk the streets (Tab)"><Footprints size={16} /> Street</button>
          </div>
          <label className="sc-switch sc-glass" title="Lines between related startups">
            <input type="checkbox" role="switch" checked={connectionsOn} onChange={() => toggleConnections()} />
            <Network size={16} /> Connections
          </label>
          <button type="button" className="sc-primary" disabled={refresh.status === 'loading'} onClick={() => void refreshSignals()}>
            {refresh.status === 'loading' ? <Loader2 size={16} className="sc-spin" /> : <RefreshCw size={16} />} Refresh startup signals
          </button>
        </nav>
        <Filters />
        <SearchResult />
      </header>

      <AnimatePresence>
        {refresh.status !== 'idle' && (
          <motion.div key={refresh.status} className={`sc-refresh-status sc-glass ${refresh.status}`} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {refresh.status === 'loading' && <><Loader2 size={16} className="sc-spin" /> Context.dev is reading news and careers pages for {refresh.scope}.</>}
            {refresh.status === 'success' && <><Check size={16} /> {refresh.message}.</>}
            {refresh.status === 'error' && <>{refresh.message} <span className="sc-muted">Saved copy from {formatDate(meta?.snapshotAt)}.</span></>}
            {refresh.status !== 'loading' && <button type="button" className="sc-icon" aria-label="Dismiss" onClick={() => useCity.setState({ refresh: { status: 'idle' } })}><X size={15} /></button>}
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="sc-rail" aria-label="City panels">
        <div className="sc-tabs-nav sc-glass" role="tablist">
          <button type="button" role="tab" aria-selected={panel === 'feed'} onClick={() => togglePanel('feed')}><Newspaper size={16} /><span>Live from Helsinki</span><span className="sc-muted">{newsCount}</span></button>
          <button type="button" role="tab" aria-selected={panel === 'missions'} onClick={() => togglePanel('missions')}><Target size={16} /><span>Missions</span><span className="sc-muted">{missionsDone} of 3</span></button>
          <button type="button" role="tab" aria-selected={panel === 'directory'} onClick={() => togglePanel('directory')}><List size={16} /><span>Directory</span><span className="sc-muted">{startups.filter((s) => s.industry !== 'hub').length}</span></button>
        </div>
        <AnimatePresence mode="wait">
          {panel && (
            <motion.section key={panel} className="sc-drawer sc-glass" role="tabpanel" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
              <header>
                <h2>{panel === 'feed' ? 'Live from Helsinki' : panel === 'missions' ? 'Discovery missions' : 'Startup directory'}</h2>
                <button type="button" className="sc-icon" aria-label="Close" onClick={() => useCity.setState({ panel: null })}><X size={16} /></button>
              </header>
              {panel === 'feed' ? <Feed /> : panel === 'missions' ? <Missions /> : <Directory />}
            </motion.section>
          )}
        </AnimatePresence>
      </aside>

      <Panel />
      <ConnectionLegend />
      <Clock />

      <div className="sc-bottom">
        {mode === 'street' && nearCompanies.length > 0 && !selectedId && (
          <motion.button type="button" className="sc-near sc-glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} onClick={() => select(near, null, 'street')}>
            <kbd>E</kbd> Visit {nearCompanies.find((s) => s.industry === 'hub')?.name ?? nearCompanies[0].name}{nearCompanies.length > 1 ? ` and ${nearCompanies.length - 1} more` : ''}
          </motion.button>
        )}
        {!demo.active && (
          <div className="sc-help">
            {mode === 'explorer'
              ? <span>Drag to move, right-drag to turn, scroll to zoom. Click a lit building. <kbd>Tab</kbd> for street level.</span>
              : <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to ride, <kbd>F</kbd> to walk, <kbd>E</kbd> to visit, <kbd>Tab</kbd> for the city view.</span>}
            <button type="button" className="sc-text-btn" onClick={() => playCutscene({ kind: 'intro' })}><Clapperboard size={15} /> Intro</button>
            <button type="button" className="sc-text-btn" onClick={() => void startDemo()}><Play size={15} /> Start demo</button>
          </div>
        )}
        <DemoBar />
      </div>
      {mode === 'street' && !selectedId && <p className="sc-street-hint">Drag anywhere to steer. Tap a startup's E prompt to visit.</p>}

      <AnimatePresence>
        {toast && <motion.div key={toast.id} className={`sc-toast sc-glass ${toast.tone}`} role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>{toast.text}</motion.div>}
      </AnimatePresence>
      {loaded && loadError && <div className="sc-load-error sc-glass" role="alert">{loadError}</div>}
      <a className="sc-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Map data OpenStreetMap contributors, buildings City of Helsinki (CC BY 4.0). Company data via Context.dev.</a>
      <CutscenePlayer />
    </div>
  )
}
