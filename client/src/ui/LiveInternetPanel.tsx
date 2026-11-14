import { useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Signal,
  Smartphone,
  Zap,
} from 'lucide-react';
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_ORDER,
  type DemoScenarioId,
  type NewsTopic,
} from '@webworld/shared';
import { useGameStore } from '../state/gameStore';

const TOPICS: { id: NewsTopic; label: string }[] = [
  { id: 'nvidia', label: 'NVIDIA' },
  { id: 'artificial_intelligence', label: 'AI' },
  { id: 'gpu_markets', label: 'GPUs' },
  { id: 'tech_companies', label: 'Big Tech' },
  { id: 'tech_announcements', label: 'Launches' },
];

function formatShortTime(iso: string | null): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function LiveInternetPanel() {
  const [minimized, setMinimized] = useState(false);

  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const selectedTopic = useGameStore((s) => s.selectedTopic);
  const setSelectedTopic = useGameStore((s) => s.setSelectedTopic);
  const selectedDemoScenario = useGameStore((s) => s.selectedDemoScenario);
  const setSelectedDemoScenario = useGameStore((s) => s.setSelectedDemoScenario);

  const newsFeed = useGameStore((s) => s.newsFeed);
  const selectedNewsId = useGameStore((s) => s.selectedNewsId);
  const activeNewsEvent = useGameStore((s) => s.activeNewsEvent);
  const selectNewsItem = useGameStore((s) => s.selectNewsItem);
  const refreshNewsFeed = useGameStore((s) => s.refreshNewsFeed);
  const syncReality = useGameStore((s) => s.syncReality);

  const syncStatus = useGameStore((s) => s.syncStatus);
  const syncError = useGameStore((s) => s.syncError);
  const clearError = useGameStore((s) => s.clearError);

  const isBusy = syncStatus === 'fetching_news' || syncStatus === 'directing_world';

  return (
    <aside className="ifruit-shell pointer-events-auto flex w-84 flex-col overflow-hidden rounded-[26px] p-2">
      {/* iFruit Top Speaker Notch & Status Bar */}
      <div className="flex items-center justify-between px-3 pt-1 pb-1.5 text-[10px] font-bold text-zinc-300">
        <div className="flex items-center gap-1">
          <Signal className="h-3 w-3 text-emerald-400" />
          <span>iFruit 5G</span>
        </div>
        <div className="h-1 w-10 rounded-full bg-zinc-700" />
        <button
          type="button"
          onClick={() => setMinimized((v) => !v)}
          className="inline-flex items-center gap-1 text-zinc-300 hover:text-amber-300"
          title={minimized ? 'Open iFruit Feed' : 'Minimize Phone'}
        >
          <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
          {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Inner Phone Screen */}
      <div className="flex max-h-[58vh] flex-col overflow-hidden rounded-[18px] bg-zinc-950 p-2.5 border border-zinc-800">
        {/* Primary SYNC REALITY Button */}
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void syncReality()}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-lime-400 px-3.5 py-2.5 text-xs font-black tracking-widest text-zinc-950 uppercase shadow-lg transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
              <span>
                {syncStatus === 'fetching_news'
                  ? 'SCANNING CONTEXT.DEV...'
                  : 'GEMINI DIRECTING WORLD...'}
              </span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 fill-zinc-950 text-zinc-950 transition-transform group-hover:scale-110" />
              <span>SYNC REALITY</span>
            </>
          )}
        </button>

        {/* App Sub-Header */}
        <div className="mt-2 flex items-center justify-between text-[10px]">
          <span className="inline-flex items-center gap-1 font-extrabold tracking-wider text-zinc-300 uppercase">
            <Smartphone className="h-3 w-3 text-amber-400" />
            {mode === 'live' ? 'LIVE INTERNET' : 'DEMO FEED'}
          </span>

          <div className="flex items-center gap-2">
            {mode === 'live' && !minimized && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void refreshNewsFeed()}
                className="inline-flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 hover:text-amber-300 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-2.5 w-2.5 ${syncStatus === 'fetching_news' ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            )}
            <button
              type="button"
              onClick={() => setMinimized((v) => !v)}
              className="text-zinc-400 hover:text-white"
            >
              {minimized ? 'Expand' : 'Pocket'}
            </button>
          </div>
        </div>

        {/* Explicit Live Error Alert (Never masks failed Live requests as mock events) */}
        {syncError && (
          <div className="mt-2 rounded-lg border border-red-500/60 bg-red-950/85 p-2 text-[11px] text-red-100">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <div className="flex-1">
                <div className="font-bold text-red-300">Live Sync Blocked ({syncError.code})</div>
                <p className="mt-0.5 text-[10px] leading-snug text-red-200/90">
                  {syncError.message}
                </p>
                {syncError.missingKeys && syncError.missingKeys.length > 0 && (
                  <div className="mt-1 font-mono text-[9px] text-amber-300">
                    Missing: {syncError.missingKeys.join(', ')}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1.5">
                  {mode === 'live' && syncError.canUseDemoMode && (
                    <button
                      type="button"
                      onClick={() => void setMode('demo')}
                      className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-zinc-950 hover:bg-amber-300"
                    >
                      Use Demo Mode
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearError}
                    className="rounded border border-red-400/40 px-1.5 py-0.5 text-[10px] text-red-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!minimized && (
          <>
            {/* Topic Filter Chips (Live) or Scenario Buttons (Demo) */}
            {mode === 'live' ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void setSelectedTopic(t.id)}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase transition ${
                      selectedTopic === t.id
                        ? 'bg-emerald-400 text-zinc-950'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedDemoScenario('cycle')}
                  className={`rounded border px-1.5 py-1 text-[9px] font-extrabold uppercase transition ${
                    selectedDemoScenario === 'cycle'
                      ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Auto-Cycle (A→B→C)
                </button>
                {DEMO_SCENARIO_ORDER.map((id: DemoScenarioId) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedDemoScenario(id)}
                    className={`truncate rounded border px-1.5 py-1 text-[9px] font-extrabold uppercase transition ${
                      selectedDemoScenario === id
                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {DEMO_SCENARIOS[id].shortTag}
                  </button>
                ))}
              </div>
            )}

            {/* News Feed Cards */}
            <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
              {newsFeed.length === 0 && (
                <div className="rounded-lg bg-zinc-900/80 p-2.5 text-center text-[11px] text-zinc-400">
                  {mode === 'live'
                    ? 'No live headlines cached yet. Tap SYNC REALITY to query Context.dev.'
                    : 'Choose a demo scenario and tap SYNC REALITY.'}
                </div>
              )}

              {newsFeed.map((ev) => {
                const isSelected = selectedNewsId === ev.id;
                const isActive = activeNewsEvent?.id === ev.id;
                const isLive = ev.provenance === 'live_web';

                return (
                  <div
                    key={ev.id}
                    onClick={() => selectNewsItem(ev.id)}
                    className={`cursor-pointer rounded-lg border p-2 transition ${
                      isActive
                        ? 'border-amber-400 bg-amber-950/25'
                        : isSelected
                          ? 'border-emerald-400/80 bg-zinc-900'
                          : 'border-zinc-800 bg-zinc-900/75 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[8px] font-black tracking-wider uppercase ${
                          isLive
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-zinc-800 text-amber-300 border border-amber-500/35'
                        }`}
                      >
                        {isLive ? 'LIVE WEB' : 'SIMULATED DEMO'}
                      </span>

                      {isActive && (
                        <span className="text-[8px] font-black tracking-wider text-amber-400 uppercase">
                          ● ACTIVE
                        </span>
                      )}
                    </div>

                    <h3 className="mt-1 text-[11px] font-bold leading-snug text-white">
                      {ev.headline}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-400">
                      {ev.summary}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between gap-1 text-[9px] text-zinc-400">
                      {isLive && ev.sourceUrl ? (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 font-bold text-sky-300 hover:underline"
                        >
                          {ev.sourceName}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <span className="truncate font-semibold text-zinc-300">
                          {ev.sourceName}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-0.5 font-mono text-[8px] text-zinc-500">
                        <Clock className="h-2.5 w-2.5" />
                        {ev.publishedAt ? `${formatShortTime(ev.publishedAt)} · ` : ''}
                        {formatShortTime(ev.retrievedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bottom Home Pill */}
      <div className="mx-auto mt-1.5 h-1 w-16 rounded-full bg-zinc-600/80" />
    </aside>
  );
}
