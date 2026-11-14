import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight, BadgeCheck, Briefcase, Clapperboard, Eye, Link2, Loader2, Navigation, Network, RefreshCw, Send, Sparkles, X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { INDUSTRIES, isHiring, recentFunding, type FactStatus, type Startup } from '../shared/startup-schema'
import { CONNECTION_KINDS, buildConnections, formatDate, initials, relativeDate } from './logic'
import { useCity } from './store'

const STATUS: Record<FactStatus, { label: string; title: string; tone: string }> = {
  verified: { label: 'Verified', title: 'Read directly from the source', tone: 'verified' },
  sourced: { label: 'Sourced', title: 'Taken from the cited page', tone: 'sourced' },
  'ai-summary': { label: 'Written by Gemini', title: 'Written by Gemini from the sourced record', tone: 'ai' },
  'ai-inferred': { label: 'Suggested by Gemini', title: 'Inferred by Gemini, not a verified fact', tone: 'ai' },
}

type Provenance = { sourceUrl: string | null; sourceName: string; retrievedAt: string; status: FactStatus }

function Source({ fact }: { fact: Provenance }) {
  const status = STATUS[fact.status]
  return (
    <span className="sc-source">
      <span className={`sc-prov ${status.tone}`} title={status.title}>{fact.status === 'verified' && <BadgeCheck size={14} />}{status.label}</span>
      {fact.sourceUrl
        ? <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" title={`Retrieved ${formatDate(fact.retrievedAt)}`}>{fact.sourceName}</a>
        : <span>{fact.sourceName}</span>}
    </span>
  )
}

function Row({ label, fact, children }: { label: string; fact: Provenance | null; children?: ReactNode }) {
  return (
    <div className="sc-row">
      <dt>{label}</dt>
      <dd>{fact && children ? <>{children}<Source fact={fact} /></> : <span className="sc-missing">Not published</span>}</dd>
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
const QUESTIONS = ['What does this company do?', 'Is it hiring?', 'What is the latest news?']

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
    <section className="sc-section sc-ask-section" id="sc-ask">
      <h3 className="sc-ai-text"><Sparkles size={16} /> Ask Gemini</h3>
      {!available ? <p className="sc-muted">Gemini is not set up on the server. The rest of the profile is unaffected.</p> : <>
        <form className="sc-ask" onSubmit={(event) => { event.preventDefault(); void ask(question) }}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={300} placeholder={`Ask about ${startup.name}`} aria-label={`Ask Gemini about ${startup.name}`} />
          <button type="submit" disabled={state.status === 'loading' || !question.trim()} aria-label="Ask">{state.status === 'loading' ? <Loader2 size={16} className="sc-spin" /> : <Send size={16} />}</button>
        </form>
        <div className="sc-suggestions">
          {QUESTIONS.map((q) => <button key={q} type="button" onClick={() => { setQuestion(q); void ask(q) }}>{q}</button>)}
        </div>
        <label className="sc-check" title={`Uses ${models?.deep ?? 'the deeper model'} instead of ${models?.research ?? 'the research model'}`}>
          <input type="checkbox" role="switch" checked={deep} onChange={(event) => setDeep(event.target.checked)} /> Deeper analysis
        </label>
        {state.status !== 'idle' && (
          <div className={`sc-answer ${state.status}`} role="status">
            <p className="sc-muted">{state.asked}</p>
            <p>{state.status === 'loading' ? 'Reading the record.' : state.text}</p>
            {state.status === 'done' && <p className="sc-muted">Written by {state.model} from the record above only.</p>}
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
  const mode = useCity((s) => s.mode)
  const monitored = useCity((s) => s.meta?.monitored) ?? NONE
  const contextAvailable = useCity((s) => s.meta?.contextAvailable)
  const { select, refreshSignals, navigateTo, toggleConnections, setMode, notify, playCutscene } = useCity.getState()
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
      notify(`Context.dev will check ${new URL(data.monitor.url).hostname} every day`, 'green')
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
          initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <button className="sc-close sc-icon" type="button" onClick={() => select(null)} aria-label="Close profile"><X size={18} /></button>
          {neighbours.length > 1 && (
            <div className="sc-neighbours" role="tablist" aria-label={`${neighbours.length} companies at this address`}>
              <span className="sc-muted">{neighbours.length} here</span>
              <div>
                {neighbours.map((s) => (
                  <button key={s.id} role="tab" aria-selected={s.id === startup.id} type="button" title={s.name} onClick={() => select(s.location!.buildingId, s.id, mode === 'street' ? 'street' : 'map')}>
                    <Logo startup={s} size={32} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="sc-panel-scroll" key={startup.id}>
            {startup.partner && (
              <a className="sc-partner-banner" href={startup.partner.source} target="_blank" rel="noopener noreferrer" title="Listed on the Junction 2026 site">
                {(startup.partner.logo ?? null) && <img src={startup.partner.logo!} alt="" />}
                <span><b>Junction 2026 {({ featured: 'featured partner', main: 'main partner', challenge: 'challenge partner', tech: 'tech partner', supporter: 'supporter', organiser: 'organiser', listed: 'partner' } as Record<string, string>)[startup.partner.tier] ?? 'partner'}</b><span>Thank you for supporting Europe's biggest hackathon.</span></span>
              </a>
            )}
            <header className="sc-head">
              <Logo startup={startup} size={56} />
              <div>
                <h2>{startup.name}</h2>
                <p className="sc-muted">
                  <span className="sc-category" style={{ ['--c' as string]: INDUSTRIES[startup.industry].color }}>{INDUSTRIES[startup.industry].label}</span>
                  {startup.companyStatus === 'Acquired' && <>, acquired{startup.acquirer ? ` by ${startup.acquirer}` : ''}</>}
                </p>
                <p className="sc-state">
                  {isHiring(startup) && <span className="hiring">Hiring, {startup.jobs!.value.length} open {startup.jobs!.value.length === 1 ? 'role' : 'roles'}</span>}
                  {recentFunding(startup) && <span className="funded">Recently funded</span>}
                  {startup.news.length > 0 && <span className="news">In the news</span>}
                </p>
              </div>
            </header>

            <div className="sc-actions">
              {startup.website
                ? <a className="sc-primary" href={startup.website} target="_blank" rel="noopener noreferrer">Visit website <ArrowUpRight size={16} /></a>
                : <button className="sc-primary" type="button" disabled title="No website on record">Visit website</button>}
              <div className="sc-row-actions">
                {startup.careersUrl
                  ? <a className="sc-text-btn" href={startup.careersUrl} target="_blank" rel="noopener noreferrer"><Briefcase size={15} /> View jobs</a>
                  : <button className="sc-text-btn" type="button" disabled title="No careers page on record"><Briefcase size={15} /> View jobs</button>}
                <button className="sc-text-btn" type="button" onClick={() => document.getElementById('sc-ask')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Sparkles size={15} /> Ask Gemini</button>
                <button className="sc-text-btn" type="button" disabled={!startup.location} onClick={() => toggleConnections(startup.id)}><Network size={15} /> Explore connections</button>
                <button className="sc-text-btn" type="button" disabled={!startup.location} onClick={() => navigateTo(startup.id)}><Navigation size={15} /> Navigate here</button>
                <button className="sc-text-btn" type="button" disabled={!startup.location} onClick={() => playCutscene({ kind: 'company', id: startup.id })}><Clapperboard size={15} /> Watch story</button>
                <button className="sc-text-btn" type="button" onClick={() => { const url = new URL(location.href); url.searchParams.set('company', startup.id); void navigator.clipboard?.writeText(url.toString()).then(() => notify('Link copied'), () => notify(url.toString())) }}><Link2 size={15} /> Copy link</button>
              </div>
            </div>

            {startup.description
              ? <div className="sc-description"><p>{startup.description.value}</p><Source fact={startup.description} /></div>
              : <p className="sc-missing">No description has been published.</p>}

            <dl className="sc-facts">
              <div className="sc-row">
                <dt>Office</dt>
                <dd>
                  {startup.location
                    ? <>{startup.location.address}{startup.location.postalCode ? `, ${startup.location.postalCode}` : ''} Helsinki<Source fact={startup.location} /></>
                    : startup.outsideDistrict && startup.reportedAddress
                      ? <>{startup.reportedAddress}, {startup.municipality}<span className="sc-muted sc-block">Confirmed in the address register. This is outside the 3D district, so it is not on the map.</span></>
                      : startup.industry === 'partner' && startup.headquarters
                      ? <>{startup.headquarters}<span className="sc-muted sc-block">Headquarters from the company profile. No office in this part of Helsinki.</span></>
                      : <span className="sc-missing">Not confirmed{startup.reportedAddress ? `. Reported as ${startup.reportedAddress}, which could not be matched to a building.` : ''}</span>}
                </dd>
              </div>
              <Row label="Founded" fact={startup.founded}>{startup.founded?.value}</Row>
              <Row label="Founders" fact={startup.founders}>{startup.founders?.value.join(', ')}</Row>
              <Row label="People" fact={startup.employees}>{startup.employees?.value}</Row>
              <Row label="Funding" fact={startup.funding}>
                {startup.funding && <>
                  {startup.funding.value.total ? `${startup.funding.value.total} raised in total` : 'Total not reported'}
                  {startup.funding.value.latestRound && (startup.funding.value.latestRound.type || startup.funding.value.latestRound.amount) && (
                    <span className="sc-block">Latest: {[startup.funding.value.latestRound.type, startup.funding.value.latestRound.amount, startup.funding.value.latestRound.date && formatDate(startup.funding.value.latestRound.date)].filter(Boolean).join(', ')}</span>
                  )}
                </>}
              </Row>
              <Row label="Investors" fact={startup.investors}>{startup.investors?.value.join(', ')}</Row>
              <div className="sc-row">
                <dt>Links</dt>
                <dd className="sc-links">
                  {startup.website ? <a href={startup.website} target="_blank" rel="noopener noreferrer">{startup.domain}</a> : <span className="sc-missing">No website on record</span>}
                  {startup.linkedin && <a href={startup.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
                </dd>
              </div>
            </dl>

            <section className="sc-section">
              <h3>Open roles</h3>
              {startup.jobs && startup.jobs.value.length > 0 ? <>
                <ul className="sc-jobs">
                  {startup.jobs.value.slice(0, 8).map((job) => (
                    <li key={job.title}>
                      {job.url ? <a href={job.url} target="_blank" rel="noopener noreferrer">{job.title}</a> : <span>{job.title}</span>}
                      {job.location && <span className="sc-muted"> {job.location}</span>}
                    </li>
                  ))}
                </ul>
                <Source fact={startup.jobs} />
              </> : <p className="sc-missing">{startup.jobs ? `The careers page listed no specific roles on ${formatDate(startup.jobs.retrievedAt)}.` : startup.careersUrl ? 'The careers page could not be read. Open it for current roles.' : 'No careers page on record.'}</p>}
            </section>

            <section className="sc-section">
              <h3>Recent news</h3>
              {startup.news.length ? (
                <ul className="sc-news">
                  {startup.news.map((item) => (
                    <li key={item.id} className={freshNews[item.id] ? 'fresh' : ''}>
                      <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                      <span className="sc-muted sc-block">{item.sourceName}, {relativeDate(item.publishedAt) || 'date not given'}{freshNews[item.id] ? ', new' : ''}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="sc-missing">{startup.newsCheckedAt ? `No headlines matched with confidence in the past year (checked ${formatDate(startup.newsCheckedAt)}).` : startup.domain ? 'News has not been checked yet.' : 'News is matched by website, and none is on record.'}</p>}
            </section>

            {connections.length > 0 && (
              <section className="sc-section">
                <h3>Connections</h3>
                <ul className="sc-connections">
                  {connections.slice(0, 10).map((c) => {
                    const other = startups.find((s) => s.id === (c.a === startup.id ? c.b : c.a))!
                    const kind = CONNECTION_KINDS[c.kind]
                    return (
                      <li key={`${c.kind}-${other.id}`}>
                        <button type="button" onClick={() => { select(other.location!.buildingId, other.id); useCity.getState().scene?.focusBuilding(other.location!.buildingId) }}>
                          <i style={{ ['--c' as string]: kind.color }} className={kind.inferred ? 'dashed' : ''} />
                          <span><b>{other.name}</b>, {kind.label.toLowerCase()}{kind.inferred && <span className="sc-ai-text"> (Gemini suggestion)</span>}<span className="sc-muted sc-block">{c.reason}</span></span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <AskGemini startup={startup} />

            <footer className="sc-foot">
              <p className="sc-muted">Updated {formatDate(startup.updatedAt)}.{startup.listedIn?.includes('Helsinki Startups Map database') ? ' Listed in the Helsinki Startups Map database.' : ''}</p>
              <div className="sc-row-actions">
                <button className="sc-text-btn" type="button" disabled={refresh.status === 'loading' || !contextAvailable || !startup.domain} onClick={() => void refreshSignals([startup.id])}>
                  {refresh.status === 'loading' ? <Loader2 size={15} className="sc-spin" /> : <RefreshCw size={15} />} Check news and jobs again
                </button>
                <button className="sc-text-btn" type="button" disabled={watching || !contextAvailable || !startup.website || monitored.includes(startup.id)} onClick={() => void watch(startup)} title="Context.dev checks the careers page or website once a day">
                  {watching ? <Loader2 size={15} className="sc-spin" /> : <Eye size={15} />} {monitored.includes(startup.id) ? 'Checked daily' : 'Watch for changes'}
                </button>
              </div>
              <p className="sc-muted">
                <span className="sc-prov verified">Verified</span> read from the source. <span className="sc-prov sourced">Sourced</span> taken from the cited page. <span className="sc-prov ai">Gemini</span> written or suggested by AI.
              </p>
            </footer>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
