import { useState } from 'react'
import {
  Activity,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  CircleCheck,
  CodeXml,
  Crosshair,
  Globe2,
  MapPin,
  Mouse,
  Radio,
  RotateCcw,
  ScanLine,
  Zap,
} from 'lucide-react'
import { useGameStore } from '../game/state'
import { LOCATIONS, SPAWN } from '../shared/locations'
import { BUILDINGS, DISTRICT } from '../world/layout'
import './hud.css'

const eventLabels = {
  robot_uprising: 'Robot uprising',
  gpu_market_crash: 'GPU market crash',
  technology_breakthrough: 'Technology breakthrough',
}

const actionLabels = { interact: 'Interact', collect: 'Collect', deliver: 'Deliver' }
const mapWidth = DISTRICT.maxX - DISTRICT.minX
const mapHeight = DISTRICT.maxZ - DISTRICT.minZ
const mapViewBox = `${DISTRICT.minX} ${DISTRICT.minZ} ${mapWidth} ${mapHeight}`
const mapXLines = [-20, -10, 0, 10, 20]
const mapZLines = [-30, -20, -10, 0, 10, 20]
const mapGrid = [
  ...mapXLines.map((x) => `M ${x} ${DISTRICT.minZ} v ${mapHeight}`),
  ...mapZLines.map((z) => `M ${DISTRICT.minX} ${z} h ${mapWidth}`),
].join(' ')

const mapDistrict = (
  <>
    <rect x={DISTRICT.minX} y={DISTRICT.minZ} width={mapWidth} height={mapHeight} className="hud-map-base" />
    <path className="hud-map-grid" d={mapGrid} />
    <line className="hud-map-streets" x1="0" x2="0" y1={DISTRICT.minZ} y2={DISTRICT.maxZ} />
    {BUILDINGS.map(({ x, z, w, d }) => (
      <rect key={`${x}:${z}`} x={x - w / 2} y={z - d / 2} width={w} height={d} className="hud-map-blocks" />
    ))}
    <circle cx={SPAWN.x} cy={SPAWN.z} r="1.4" className="hud-map-spawn" />
    {Object.entries(LOCATIONS).map(([id, location]) => (
      <circle key={id} cx={location.x} cy={location.z} r="1.25" className="hud-map-location">
        <title>{location.label}</title>
      </circle>
    ))}
  </>
)

function formatTime(value: string | null | undefined) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

function sourceLink(value: string | null | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

function MiniMap() {
  const player = useGameStore((state) => state.player)
  const mission = useGameStore((state) => state.mission)
  const step = mission.status === 'active' ? mission.steps[mission.stepIndex] : undefined
  const objective = step ? LOCATIONS[step.location] : undefined
  const playerAngle = player.heading * 180 / Math.PI
  const targetAngle = objective ? Math.atan2(objective.x - player.x, player.z - objective.z) * 180 / Math.PI : null
  const distance = objective ? Math.round(Math.hypot(objective.x - player.x, objective.z - player.z)) : null
  const bearing = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][((Math.round(playerAngle / 45) % 8) + 8) % 8]

  return (
    <section className="hud-map hud-surface" aria-label="Minimap">
      <div className="hud-map-heading">
        <span><Crosshair size={13} /> DISTRICT MAP</span>
        <b>{bearing}</b>
      </div>
      <div className="hud-map-window">
        <svg viewBox={mapViewBox} role="img" aria-label="Street map showing your position and mission destination">
          {mapDistrict}
          {objective && (
            <>
              <line x1={player.x} y1={player.z} x2={objective.x} y2={objective.z} className="hud-map-route" />
              <rect x={objective.x - 1.5} y={objective.z - 1.5} width="3" height="3" transform={`rotate(45 ${objective.x} ${objective.z})`} className="hud-map-target" />
            </>
          )}
          <path d="M0 -3.3 2.25 2.4 0 1.35 -2.25 2.4Z" transform={`translate(${player.x} ${player.z}) rotate(${playerAngle})`} className="hud-map-player" />
        </svg>
        <span className="hud-map-north">N</span>
      </div>
      <div className="hud-map-footer">
        {objective && targetAngle !== null ? (
          <><ArrowUp size={15} style={{ transform: `rotate(${targetAngle - playerAngle}deg)` }} /> <span>{objective.label}</span><b>{distance} m</b></>
        ) : (
          <><MapPin size={13} /><span>Free roam</span></>
        )}
      </div>
    </section>
  )
}

export function Hud() {
  const mode = useGameStore((state) => state.mode)
  const liveAvailable = useGameStore((state) => state.liveAvailable)
  const status = useGameStore((state) => state.status)
  const error = useGameStore((state) => state.error)
  const news = useGameStore((state) => state.news)
  const attemptedNews = useGameStore((state) => state.attemptedNews)
  const scenario = useGameStore((state) => state.scenario)
  const mission = useGameStore((state) => state.mission)
  const nearby = useGameStore((state) => state.nearby)
  const setMode = useGameStore((state) => state.setMode)
  const sync = useGameStore((state) => state.sync)
  const interact = useGameStore((state) => state.interact)
  const reset = useGameStore((state) => state.reset)
  const [feedOpen, setFeedOpen] = useState(true)

  const busy = status === 'syncing'
  const step = mission.status === 'active' ? mission.steps[mission.stepIndex] : undefined
  const eventLabel = scenario ? eventLabels[scenario.eventType] : undefined
  const displayedNews = attemptedNews ?? news
  const isDemoSource = displayedNews?.mode === 'demo'
  const url = isDemoSource ? undefined : sourceLink(displayedNews?.sourceUrl)
  const activeSourceUrl = news?.mode === 'live' ? sourceLink(news.sourceUrl) : undefined
  const statusLabel = { idle: 'Standby', syncing: 'Syncing', ready: 'World active', error: 'Sync failed' }[status]

  return (
    <div className="hud" data-event={scenario?.eventType}>
      <header className="hud-top">
        <div className="hud-identity">
          <div className="hud-logo" aria-hidden="true"><Zap size={25} strokeWidth={2.3} /></div>
          <div>
            <h1>WEB<span>WORLD</span></h1>
            <div className="hud-wordmark-sub">THE INTERNET IS THE MAP</div>
          </div>
        </div>

        <div className="hud-top-right">
          <div className="hud-sector" title="Current district">
            <MapPin size={15} />
            <div><span>LOCATION</span><b>NEON DISTRICT</b></div>
          </div>
          <div className="hud-mode-wrap">
            <div className="hud-mode" role="group" aria-label="Reality source">
              <button type="button" onClick={() => setMode('demo')} aria-pressed={mode === 'demo'}>Demo</button>
              <button type="button" onClick={() => setMode('live')} aria-pressed={mode === 'live'} disabled={!liveAvailable} title={liveAvailable ? 'Fetch real headlines and generate a scenario' : 'Live mode requires server credentials'}>Live</button>
            </div>
            {!liveAvailable && <span className="hud-mode-note">LIVE OFFLINE</span>}
          </div>
        </div>
      </header>

      <section className="hud-mission hud-surface" aria-label="Mission tracker">
        <div className="hud-panel-top">
          <Crosshair size={16} />
          <h2>Mission tracker</h2>
          {scenario && <span className="hud-mission-count">{mission.status === 'complete' ? mission.steps.length : Math.min(mission.stepIndex + 1, mission.steps.length)}/{mission.steps.length}</span>}
        </div>
        <div className="hud-mission-body" aria-live="polite">
          {scenario ? (
            <>
              <div className="hud-mission-state"><i /> {mission.status === 'complete' ? 'Mission complete' : eventLabel}</div>
              <h3>{scenario.mission.title}</h3>
              <p>{scenario.mission.objective}</p>
              <ol className="hud-steps">
                {mission.steps.map((item, index) => {
                  const complete = mission.status === 'complete' || index < mission.stepIndex
                  const current = index === mission.stepIndex && mission.status === 'active'
                  return (
                    <li key={`${item.location}-${index}`} data-complete={complete} aria-current={current ? 'step' : undefined}>
                      {complete ? <CircleCheck size={15} /> : <span className="hud-step-node" aria-hidden="true">{index + 1}</span>}
                      <span>{item.label}</span>
                    </li>
                  )
                })}
              </ol>
            </>
          ) : (
            <>
              <div className="hud-mission-state"><i /> Free roam</div>
              <h3>Explore Neon District</h3>
              <p>Sync a headline to unlock your first mission.</p>
            </>
          )}
        </div>
      </section>

      <aside className="hud-feed hud-surface" aria-label="Live Internet">
        <div className="hud-panel-top">
          <Globe2 size={16} />
          <h2>Live Internet</h2>
          <button className="hud-icon-button" type="button" onClick={() => setFeedOpen(!feedOpen)} aria-label={feedOpen ? 'Collapse Internet feed' : 'Expand Internet feed'} aria-expanded={feedOpen} aria-controls="hud-feed-content">
            <ChevronDown size={15} />
          </button>
        </div>

        <div id="hud-feed-content" className="hud-feed-content" hidden={!feedOpen}>
          <div className="hud-feed-body">
            <div className="hud-feed-status">
              <span><Radio size={13} /> {mode === 'demo' ? 'Simulation feed' : 'Context.dev feed'}</span>
              <span className="hud-status" data-status={status} role="status"><i /> {statusLabel}</span>
            </div>
            <button className="hud-sync" type="button" onClick={() => void sync()} disabled={busy || (mode === 'live' && !liveAvailable)}>
              <Zap size={17} /> {busy ? 'SYNCING REALITY…' : 'SYNC REALITY'} <ArrowUpRight size={16} />
            </button>
            {displayedNews ? (
              <div className="hud-headline">
                <div className="hud-headline-label" data-demo={isDemoSource}>
                  {attemptedNews ? 'Retrieved headline · scenario failed' : isDemoSource ? 'Fictional demo headline' : 'Retrieved headline'}
                </div>
                <h3>{displayedNews.headline}</h3>
                <p>{displayedNews.summary}</p>
                <dl>
                  <div>
                    <dt>Source</dt>
                    <dd>{url ? <a href={url} target="_blank" rel="noreferrer">{displayedNews.sourceName}<ArrowUpRight size={12} /></a> : displayedNews.sourceName}</dd>
                  </div>
                  <div><dt>Published</dt><dd>{formatTime(displayedNews.publishedAt)}</dd></div>
                  <div><dt>Retrieved</dt><dd>{formatTime(displayedNews.retrievedAt)}</dd></div>
                </dl>
              </div>
            ) : (
              <div className="hud-feed-empty">
                <div className="hud-radar" aria-hidden="true"><ScanLine size={24} /></div>
                <div><h3>Awaiting signal</h3><p>{mode === 'demo' ? 'Load a simulated headline to trigger a city event.' : 'Pull a fresh technology headline into Neon District.'}</p></div>
              </div>
            )}
            {error && <p className="hud-error" role="alert">{error}</p>}
            {attemptedNews && news && (
              <p className="hud-active-source">Active world source · {activeSourceUrl ? <a href={activeSourceUrl} target="_blank" rel="noreferrer">{news.sourceName}<ArrowUpRight size={12} /></a> : news.sourceName}{news.mode === 'demo' && ' (fictional)'}</p>
            )}
            <div className="hud-director"><Activity size={13} /><span>{mode === 'demo' ? 'SCRIPTED WORLD DIRECTOR' : 'GEMINI WORLD DIRECTOR'}</span></div>

            {scenario && (
              <details className="hud-briefing">
                <summary><Radio size={13} /> Fictional briefing <ChevronDown size={13} /></summary>
                <p>{scenario.mission.description}</p>
                {scenario.dialogue.map((line, index) => <p key={index}><b>{line.speaker}</b> {line.text}</p>)}
              </details>
            )}
            <details className="hud-debug">
              <summary><CodeXml size={14} /> Director JSON <ChevronDown size={13} /></summary>
              {scenario ? <pre tabIndex={0}>{JSON.stringify(scenario, null, 2)}</pre> : <p>Sync a headline to inspect the scenario.</p>}
            </details>
          </div>
        </div>
      </aside>

      <div className="hud-center">
        {scenario && mission.status === 'active' && mission.stepIndex === 0 && (
          <div key={news?.id ?? scenario.mission.title} className="hud-announcement" aria-hidden="true">
            <span><Activity size={13} /> WORLD EVENT</span>
            <strong>{eventLabel}</strong>
          </div>
        )}
        {mission.status === 'complete' && (
          <div className="hud-completion" role="status"><CircleCheck size={19} /> Mission complete</div>
        )}
        {nearby && step && (
          <button type="button" className="hud-interact" onClick={interact}><kbd>E</kbd> {actionLabels[step.action]} <span>{step.label}</span></button>
        )}
      </div>

      <MiniMap />

      <footer className="hud-controls" aria-label="Game controls">
        <span className="hud-move"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><b>Move</b></span>
        <span><Mouse size={16} /><b>Click + look</b></span>
        <span><kbd>SHIFT</kbd><b>Sprint</b></span>
        <span><kbd>E</kbd><b>Interact</b></span>
        <span className="hud-escape"><kbd>ESC</kbd><b>Release cursor</b></span>
      </footer>
      <button type="button" className="hud-reset" onClick={reset} disabled={busy}><RotateCcw size={14} /> Reset world</button>
    </div>
  )
}
