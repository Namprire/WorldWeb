import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeCheck, Briefcase, Building2, ExternalLink, Eye, Linkedin, Loader2, MapPin, Navigation, Network,
  Newspaper, RefreshCw, Send, Sparkles, X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { INDUSTRIES, isHiring, recentFunding, type FactStatus, type Startup } from '../shared/startup-schema'
import { CONNECTION_KINDS, buildConnections, formatDate, initials, relativeDate } from './logic'
import { useCity } from './store'

const STATUS: Record<FactStatus, { label: string; title: string; className: string }> = {
  verified: { label: 'Verified', title: 'Read directly from the source', className: 'sc-prov verified' },
  sourced: { label: 'Sourced', title: 'Extracted from the cited page by the Context.dev research agent', className: 'sc-prov sourced' },
  'ai-summary': { label: 'AI summary', title: 'Written by Gemini from the sourced record', className: 'sc-prov ai' },
  'ai-inferred': { label: 'AI suggestion', title: 'Inferred by Gemini. Not a verified fact', className: 'sc-prov ai' },
}

type Provenance = { sourceUrl: string | null; sourceName: string; retrievedAt: string; status: FactStatus }

function Source({ fact }: { fact: Provenance }) {
  const status = STATUS[fact.status]
  return (
    <span className="sc-source">
      <span className={status.className} title={status.title}>{fact.status === 'verified' && <BadgeCheck size={11} />}{status.label}</span>
      {fact.sourceUrl
        ? <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" title={`Retrieved ${formatDate(fact.retrievedAt)}`}>{fact.sourceName}<ExternalLink size={10} /></a>
        : <span>{fact.sourceName}</span>}
    </span>
  )
}

function Row({ label, fact, children }: { label: string; fact: Provenance | null; children?: ReactNode }) {
  return (
    <div className="sc-row">
      <dt>{label}</dt>
      <dd>
        {fact && children ? <>{children}<Source fact={fact} /></> : <span className="sc-missing">Not publicly verified</span>}
      </dd>
    </div>
  )
}

export function Logo({ startup, size = 44 }: { startup: Pick<Startup, 'logo' | 'name' | 'industry' | 'logoOnDark'>; size?: number }) {
  return (
    <span className={`sc-logo-box${startup.logoOnDark ? ' dark' : ''}`} style={{ width: size, height: size, ['--c' as string]: INDUSTRIES[startup.industry].color }}>
      {startup.logo ? <img src={startup.logo} alt="" /> : <b>{initials(startup.name)}</b>}
    </span>
  )
}

const NONE: string[] = []
const QUESTIONS = ['What does this company do?', 'Is it hiring, and for which roles?', 'What is the latest news?']

function AskGemini({ startup }: { startup: Startup }) {
  const available = useCity((s) => s.meta?.geminiAvailable)
  const models = useCity((s) => s.meta?.models)
  const [question, setQuestion] = useState('')
  const [deep, setDeep] = useState(false)
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; text?: string; model?: string; asked?: string }>({ status: 'idle' })
  useEffect(() => { setState({ status: 'idle' }); setQuestion('') }, [startup.id])

  async function ask(text: string) {
    if (!text.trim() || state.status === 'loading') return
    setState({ status: 'loading', asked: text })
    try {
      const response = await fetch('/api/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: startup.id, question: text, deep }), signal: AbortSignal.timeout(30_000),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setState({ status: 'done', text: data.answer, model: data.model, asked: text })
    } catch (error) {
      setState({ status: 'error', asked: text, text: error instanceof Error && error.message ? error.message : 'Gemini could not answer right now.' })
    }
  }

  return (
    <section className="sc-section" id="sc-ask">
      <h3><Sparkles size={13} /> Ask Gemini</h3>
      {!available ? <p className="sc-note">Gemini is not configured on the server. The verified profile is unaffected.</p> : <>
        <form className="sc-ask" onSubmit={(event) => { event.preventDefault(); void ask(question) }}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={300} placeholder={`Ask about ${startup.name}…`} aria-label={`Ask Gemini about ${startup.name}`} />
          <button type="submit" disabled={state.status === 'loading' || !question.trim()} aria-label="Ask">{state.status === 'loading' ? <Loader2 size={14} className="sc-spin" /> : <Send size={14} />}</button>
        </form>
        <div className="sc-chips small">
          {QUESTIONS.map((q) => <button key={q} type="button" onClick={() => { setQuestion(q); void ask(q) }}>{q}</button>)}
          <label className="sc-check" title={`Uses ${models?.deep ?? 'the deep model'} instead of ${models?.research ?? 'the research model'}`}><input type="checkbox" checked={deep} onChange={(event) => setDeep(event.target.checked)} /> Deeper analysis</label>
        </div>
        {state.status !== 'idle' && (
          <div className={`sc-answer ${state.status}`} role="status">
            <small>{state.asked}</small>
            {state.status === 'loading' ? <p className="sc-dim">Reading the sourced record…</p> : <p>{state.text}</p>}
            {state.status === 'done' && <span className="sc-source"><span className="sc-prov ai">AI summary</span><span>{state.model} · answers only from the sourced record above</span></span>}
          </div>
        )}
      </>}
    </section>
  )
}

export function Panel() {
  const startups = useCity((s) => s.startups)
  const selectedId = useCity((s) => s.selectedId)
  const selectedBuilding = useCity((s) => s.selectedBuilding)
  const suggestions = useCity((s) => s.suggestions)
  const refresh = useCity((s) => s.refresh)
  const freshNews = useCity((s) => s.freshNews)
  const route = useCity((s) => s.route)
  const mode = useCity((s) => s.mode)
  const monitored = useCity((s) => s.meta?.monitored) ?? NONE
  const contextAvailable = useCity((s) => s.meta?.contextAvailable)
  const { select, refreshSignals, navigateTo, toggleConnections, setMode, notify } = useCity.getState()
  const [watching, setWatching] = useState(false)

  const startup = startups.find((s) => s.id === selectedId) ?? null
  const neighbours = useMemo(() => selectedBuilding ? startups.filter((s) => s.location?.buildingId === selectedBuilding) : [], [startups, selectedBuilding])
  const connections = useMemo(() => startup ? buildConnections(startups, suggestions.items).filter((c) => c.a === startup.id || c.b === startup.id) : [], [startups, suggestions, startup])

  async function watch(target: Startup) {
    setWatching(true)
    try {
      const response = await fetch('/api/monitors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: target.id }), signal: AbortSignal.timeout(30_000) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      const meta = useCity.getState().meta
      if (meta) useCity.setState({ meta: { ...meta, monitored: [...new Set([...meta.monitored, target.id])] } })
      notify(`Context.dev now watches ${new URL(data.monitor.url).hostname} daily`, 'green')
    } catch (error) {
      notify(error instanceof Error && error.message ? error.message : 'Monitoring could not be started.')
    } finally {
      setWatching(false)
    }
  }

  return (
    <AnimatePresence>
      {startup && (
        <motion.aside
          key="panel" className="sc-panel sc-glass" aria-label={`${startup.name} profile`}
          initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        >
          <button className="sc-close" type="button" onClick={() => select(null)} aria-label="Close profile"><X size={16} /></button>
          {neighbours.length > 1 && (
            <div className="sc-tabs" role="tablist" aria-label="Companies in this building">
              <span><Building2 size={12} /> {neighbours.length} at this address</span>
              <div>
                {neighbours.map((s) => (
                  <button key={s.id} role="tab" aria-selected={s.id === startup.id} type="button" title={s.name} onClick={() => select(s.location!.buildingId, s.id, mode === 'street' ? 'street' : 'map')}>
                    <Logo startup={s} size={30} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="sc-panel-scroll" key={startup.id}>
            <header className="sc-head">
              <Logo startup={startup} size={56} />
              <div>
                <h2>{startup.name}</h2>
                <p>
                  <span className="sc-industry" style={{ ['--c' as string]: INDUSTRIES[startup.industry].color }}>{INDUSTRIES[startup.industry].label}</span>
                  {startup.profileIndustry && <span className="sc-dim"> · {startup.profileIndustry}</span>}
                </p>
                <div className="sc-badges-row">
                  {isHiring(startup) && <span className="sc-badge hiring"><Briefcase size={11} /> Hiring · {startup.jobs!.value.length} open</span>}
                  {recentFunding(startup) && <span className="sc-badge funded">Recently funded</span>}
                  {startup.news.length > 0 && <span className="sc-badge news"><Newspaper size={11} /> {startup.news.length} in the news</span>}
                </div>
              </div>
            </header>

            <div className="sc-actions">
              <a className="sc-btn primary" href={startup.website} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Visit website</a>
              {startup.careersUrl
                ? <a className="sc-btn" href={startup.careersUrl} target="_blank" rel="noopener noreferrer"><Briefcase size={13} /> View jobs</a>
                : <button className="sc-btn" type="button" disabled title="No careers page in the company profile"><Briefcase size={13} /> View jobs</button>}
              <button className="sc-btn" type="button" onClick={() => document.getElementById('sc-ask')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Sparkles size={13} /> Ask Gemini</button>
              <button className="sc-btn" type="button" disabled={!startup.location} onClick={() => toggleConnections(startup.id)}><Network size={13} /> Explore connections</button>
              <button className="sc-btn" type="button" disabled={!startup.location} onClick={() => navigateTo(startup.id)}><Navigation size={13} /> Navigate here</button>
            </div>
            {route && 'targetId' in route && route.targetId === startup.id && (
              <p className="sc-route-note">
                <Navigation size={12} /> {Math.round(route.metres)} m along mapped streets · about {Math.max(1, Math.round(route.metres / 80))} min on foot
                {mode === 'explorer' && <button type="button" onClick={() => setMode('street')}>Go to street level</button>}
                <button type="button" onClick={() => navigateTo(null)}>Clear</button>
              </p>
            )}

            {startup.description
              ? <p className="sc-description">{startup.description.value}<Source fact={startup.description} /></p>
              : <p className="sc-missing">No description in the company profile.</p>}

            <dl className="sc-facts">
              <div className="sc-row">
                <dt><MapPin size={12} /> Office</dt>
                <dd>
                  {startup.location
                    ? <>{startup.location.address}{startup.location.postalCode ? `, ${startup.location.postalCode}` : ''} Helsinki<Source fact={startup.location} /></>
                    : <><span className="sc-missing">Location not verified{startup.reportedAddress ? ` · profile reports “${startup.reportedAddress}”, which is outside the mapped area or could not be matched to a building` : ''}</span></>}
                </dd>
              </div>
              <Row label="Founded" fact={startup.founded}>{startup.founded?.value}</Row>
              <Row label="Founders" fact={startup.founders}>{startup.founders?.value.join(', ')}</Row>
              <Row label="Employees" fact={startup.employees}>{startup.employees?.value}</Row>
              <Row label="Funding" fact={startup.funding}>
                {startup.funding && <>
                  {startup.funding.value.total ?? 'Total not reported'}
                  {startup.funding.value.latestRound && (startup.funding.value.latestRound.type || startup.funding.value.latestRound.amount) && (
                    <span className="sc-sub">Latest: {[startup.funding.value.latestRound.type, startup.funding.value.latestRound.amount, startup.funding.value.latestRound.date].filter(Boolean).join(' · ')}</span>
                  )}
                </>}
              </Row>
              <Row label="Investors" fact={startup.investors}>{startup.investors?.value.join(', ')}</Row>
              <div className="sc-row">
                <dt>Links</dt>
                <dd className="sc-links">
                  <a href={startup.website} target="_blank" rel="noopener noreferrer">{startup.domain}<ExternalLink size={10} /></a>
                  {startup.linkedin && <a href={startup.linkedin} target="_blank" rel="noopener noreferrer"><Linkedin size={11} /> LinkedIn</a>}
                </dd>
              </div>
            </dl>

            <section className="sc-section">
              <h3><Briefcase size={13} /> Open positions</h3>
              {startup.jobs && startup.jobs.value.length > 0 ? <>
                <ul className="sc-jobs">
                  {startup.jobs.value.slice(0, 8).map((job) => (
                    <li key={job.title}>
                      {job.url ? <a href={job.url} target="_blank" rel="noopener noreferrer">{job.title}</a> : <span>{job.title}</span>}
                      {job.location && <small>{job.location}</small>}
                    </li>
                  ))}
                </ul>
                <Source fact={startup.jobs} />
              </> : <p className="sc-missing">{startup.jobs ? `No specific openings were listed on the careers page when it was read on ${formatDate(startup.jobs.retrievedAt)}.` : startup.careersUrl ? 'The careers page could not be read. Open it for current positions.' : 'No careers page in the company profile.'}</p>}
            </section>

            <section className="sc-section">
              <h3><Newspaper size={13} /> Recent news</h3>
              {startup.news.length ? (
                <ul className="sc-news">
                  {startup.news.map((item) => (
                    <li key={item.id} className={freshNews[item.id] ? 'fresh' : ''}>
                      <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                      <small>
                        {item.eventType !== 'other' && <i className={`sc-event ${item.eventType}`}>{item.eventType}</i>}
                        {item.sourceName} · {relativeDate(item.publishedAt) || 'date not given'}
                        {freshNews[item.id] && <b> · new</b>}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : <p className="sc-missing">{startup.newsCheckedAt ? `No confidently matched headlines in the past year (checked ${formatDate(startup.newsCheckedAt)}).` : 'News has not been checked yet.'}</p>}
              {startup.news.length > 0 && <span className="sc-source"><span className="sc-prov verified"><BadgeCheck size={11} />Verified</span><span>Publisher headlines via Context.dev news · type tags are keyword-based</span></span>}
            </section>

            {connections.length > 0 && (
              <section className="sc-section">
                <h3><Network size={13} /> Connections</h3>
                <ul className="sc-connections">
                  {connections.slice(0, 10).map((c) => {
                    const other = startups.find((s) => s.id === (c.a === startup.id ? c.b : c.a))!
                    const kind = CONNECTION_KINDS[c.kind]
                    return (
                      <li key={`${c.kind}-${other.id}`}>
                        <button type="button" onClick={() => { select(other.location!.buildingId, other.id); useCity.getState().scene?.focusBuilding(other.location!.buildingId) }}>
                          <i style={{ background: kind.color }} className={kind.inferred ? 'dashed' : ''} />
                          <span><b>{other.name}</b> · {kind.label}<small>{c.reason}</small></span>
                        </button>
                        <span className={`sc-prov ${kind.inferred ? 'ai' : 'verified'}`}>{kind.inferred ? 'AI suggestion' : 'From records'}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <AskGemini startup={startup} />

            <footer className="sc-foot">
              <p>Last updated {formatDate(startup.updatedAt)} · profile retrieved through Context.dev</p>
              <div>
                <button className="sc-btn small" type="button" disabled={refresh.status === 'loading' || !contextAvailable} onClick={() => void refreshSignals([startup.id])}>
                  {refresh.status === 'loading' ? <Loader2 size={12} className="sc-spin" /> : <RefreshCw size={12} />} Re-read news &amp; jobs
                </button>
                <button className="sc-btn small" type="button" disabled={watching || !contextAvailable || monitored.includes(startup.id)} onClick={() => void watch(startup)} title="Creates a daily Context.dev monitor on this company's careers page or website">
                  {watching ? <Loader2 size={12} className="sc-spin" /> : <Eye size={12} />} {monitored.includes(startup.id) ? 'Monitored daily' : 'Monitor for changes'}
                </button>
              </div>
              <p className="sc-legend">
                <span className="sc-prov verified"><BadgeCheck size={11} />Verified</span> read from the source ·
                <span className="sc-prov sourced">Sourced</span> extracted from the cited page ·
                <span className="sc-prov ai">AI</span> generated or inferred
              </p>
            </footer>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
