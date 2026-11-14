import { Code2, X } from 'lucide-react';
import { useGameStore } from '../state/gameStore';

export function AiDebugDrawer() {
  const debugOpen = useGameStore((s) => s.debugOpen);
  const toggleDebugDrawer = useGameStore((s) => s.toggleDebugDrawer);
  const lastDirectorResponse = useGameStore((s) => s.lastDirectorResponse);
  const lastSyncMeta = useGameStore((s) => s.lastSyncMeta);

  if (!debugOpen) return null;

  return (
    <div className="hud-panel pointer-events-auto w-96 max-w-[90vw] rounded-xl p-3 text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-orange-300 uppercase">
          <Code2 className="h-4 w-4" />
          <span>Structured AI Director JSON</span>
        </div>
        <button
          type="button"
          onClick={toggleDebugDrawer}
          className="text-slate-400 hover:text-white"
          aria-label="Close debug drawer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {lastSyncMeta && (
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-300">
          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono">
            source: {lastSyncMeta.directorSource}
          </span>
          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-cyan-300">
            model: {lastSyncMeta.modelUsed}
          </span>
          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-lime-300">
            {lastSyncMeta.latencyMs}ms
          </span>
        </div>
      )}

      {lastSyncMeta?.modelWarning && (
        <div className="mt-1.5 rounded border border-amber-500/40 bg-amber-950/50 px-2 py-1 text-[10px] text-amber-200">
          {lastSyncMeta.modelWarning}
        </div>
      )}

      <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 font-mono text-[10px] leading-relaxed text-cyan-200">
        {lastDirectorResponse
          ? JSON.stringify(lastDirectorResponse, null, 2)
          : '// Click SYNC REALITY to inspect Zod-validated WorldDirectorResponse JSON'}
      </pre>
    </div>
  );
}
