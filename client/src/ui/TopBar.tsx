import { Globe, Radio, Star, Terminal } from 'lucide-react';
import { useGameStore } from '../state/gameStore';

const EVENT_STARS: Record<string, { stars: number; label: string }> = {
  robot_uprising: { stars: 5, label: 'ROBOT UPRISING' },
  gpu_market_crash: { stars: 4, label: 'MARKET CRASH' },
  ceo_controversy: { stars: 3, label: 'CEO CONTROVERSY' },
  tech_breakthrough: { stars: 2, label: 'AI BREAKTHROUGH' },
  product_launch: { stars: 2, label: 'PRODUCT LAUNCH' },
};

export function TopBar() {
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const serverOnline = useGameStore((s) => s.serverOnline);
  const serverStatus = useGameStore((s) => s.serverStatus);
  const selectedModel = useGameStore((s) => s.selectedModel);
  const supportedModels = useGameStore((s) => s.supportedModels);
  const setSelectedModel = useGameStore((s) => s.setSelectedModel);
  const activeEventType = useGameStore((s) => s.activeEventType);
  const computeTflops = useGameStore((s) => s.computeTflops);
  const missionsCompleted = useGameStore((s) => s.missionsCompleted);
  const debugOpen = useGameStore((s) => s.debugOpen);
  const toggleDebugDrawer = useGameStore((s) => s.toggleDebugDrawer);

  const starInfo = activeEventType ? EVENT_STARS[activeEventType] ?? { stars: 1, label: 'WORLD EVENT' } : { stars: 0, label: 'LOS SILICON' };
  const liveReady = !!serverStatus?.liveReady;
  const cashDollars = computeTflops * 1_000_000;

  return (
    <header className="pointer-events-auto flex flex-col items-end gap-1.5">
      {/* GTA V Top-Right Wanted / World Chaos Stars */}
      <div className="flex items-center gap-1.5">
        {starInfo.stars > 0 && (
          <span className="mr-1.5 rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-black tracking-wider text-white uppercase shadow">
            {starInfo.label}
          </span>
        )}
        {[1, 2, 3, 4, 5].map((idx) => {
          const lit = idx <= starInfo.stars;
          return (
            <Star
              key={idx}
              className={`h-5 w-5 ${
                lit
                  ? 'wanted-star-active fill-amber-300 text-amber-300'
                  : 'fill-zinc-900/50 text-zinc-600/60'
              }`}
            />
          );
        })}
      </div>

      {/* GTA V Iconic Green Cash & NVIDIA Compute Readout */}
      <div className="gta-cash-shadow flex items-baseline gap-2.5 font-sans">
        <span className="text-2xl font-black tracking-tight text-emerald-400">
          ${cashDollars.toLocaleString()}
        </span>
        <span className="rounded bg-zinc-950/80 px-2 py-0.5 font-mono text-xs font-bold text-lime-400 border border-zinc-700/70">
          {computeTflops.toLocaleString()} TFLOPS
        </span>
        {missionsCompleted > 0 && (
          <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-black text-zinc-950">
            {missionsCompleted} PASSED
          </span>
        )}
      </div>

      {/* Compact Director Mode & Gemini Model Bar */}
      <div className="gta-box flex flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5">
        <span className="text-[11px] font-black tracking-wider text-white">
          WEBWORLD
        </span>
        <span className="h-3.5 w-px bg-zinc-700" />

        {/* DEMO vs LIVE Mode Switcher */}
        <div className="flex rounded bg-zinc-900 p-0.5 border border-zinc-700/80">
          <button
            type="button"
            onClick={() => void setMode('demo')}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wide transition ${
              mode === 'demo'
                ? 'bg-amber-400 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="h-3 w-3" />
            DEMO MODE
          </button>
          <button
            type="button"
            onClick={() => void setMode('live')}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wide transition ${
              mode === 'live'
                ? 'bg-emerald-400 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Globe className="h-3 w-3" />
            LIVE MODE
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                liveReady ? 'bg-zinc-950' : 'bg-amber-600'
              }`}
              title={
                liveReady
                  ? 'Gemini & Context.dev API keys configured'
                  : serverOnline
                    ? 'API keys missing in .env — Live Mode will report required credentials'
                    : 'Backend offline'
              }
            />
          </button>
        </div>

        {/* Gemini Model Selector */}
        <select
          id="gemini-model-select"
          aria-label="Gemini World Director Model"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-200 outline-none focus:border-amber-400"
        >
          {supportedModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        {/* AI JSON Inspector */}
        <button
          type="button"
          onClick={toggleDebugDrawer}
          className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold transition ${
            debugOpen
              ? 'border-amber-400 bg-amber-400/20 text-amber-300'
              : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
          }`}
        >
          <Terminal className="h-3 w-3" />
          AI JSON
        </button>
      </div>
    </header>
  );
}
