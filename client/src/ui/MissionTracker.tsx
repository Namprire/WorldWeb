import { ExternalLink, MapPin, ShieldCheck } from 'lucide-react';
import { CITY_LANDMARKS } from '@webworld/shared';
import { useGameStore } from '../state/gameStore';

export function MissionTracker() {
  const activeMission = useGameStore((s) => s.activeMission);
  const activeNewsEvent = useGameStore((s) => s.activeNewsEvent);

  if (!activeMission) {
    return (
      <section className="gta-box pointer-events-auto max-w-xs rounded border-l-4 border-l-amber-400 px-3.5 py-2.5">
        <div className="text-[11px] font-black tracking-wider text-amber-400 uppercase">
          LOS SILICON // FREE ROAM
        </div>
        <p className="mt-1 text-xs leading-snug text-zinc-200">
          Roam downtown as <span className="font-bold text-white">Jensen H.</span>, press{' '}
          <span className="font-mono font-bold text-lime-400">F</span> near a supercar to drive, or tap{' '}
          <span className="font-bold text-amber-300">SYNC REALITY</span> on your iFruit phone.
        </p>
      </section>
    );
  }

  const { spec, status, distanceMeters } = activeMission;
  const landmark = CITY_LANDMARKS[spec.target_landmark];
  const isCompleted = status === 'completed';

  return (
    <section
      className={`gta-box pointer-events-auto w-80 rounded border-l-4 px-3.5 py-2.5 transition-all ${
        isCompleted ? 'border-l-emerald-400' : 'border-l-amber-400'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-black tracking-widest uppercase ${
            isCompleted ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {isCompleted ? 'MISSION PASSED' : 'CURRENT OBJECTIVE'}
        </span>
        <span className="font-mono text-[11px] font-extrabold text-emerald-400">
          +${(spec.reward_tflops * 1_000_000).toLocaleString()} ({spec.reward_tflops} TF)
        </span>
      </div>

      <h2 className="mt-0.5 text-sm font-black tracking-tight text-white uppercase">
        {spec.title}
      </h2>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-300">{spec.storyline}</p>

      {/* GTA V Yellow Waypoint Instruction */}
      <div className="mt-2 flex items-center justify-between gap-2 rounded bg-zinc-900/90 px-2.5 py-1.5 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>
            Go to <span className="font-bold text-amber-300">{landmark.name}</span>
          </span>
        </span>
        {!isCompleted && (
          <span className="shrink-0 font-mono text-xs font-bold text-amber-400">
            {distanceMeters}m
          </span>
        )}
      </div>

      {/* Strict Live vs Simulated Demo Provenance Strip */}
      {activeNewsEvent && (
        <div className="mt-2 flex items-center justify-between gap-1 border-t border-zinc-800 pt-1.5 text-[10px]">
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-extrabold uppercase ${
              activeNewsEvent.provenance === 'live_web'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-950 text-amber-200 border border-amber-500/40'
            }`}
          >
            <ShieldCheck className="h-3 w-3" />
            {activeNewsEvent.provenance === 'live_web' ? 'LIVE WEB' : 'SIMULATED DEMO'}
          </span>

          {activeNewsEvent.provenance === 'live_web' && activeNewsEvent.sourceUrl ? (
            <a
              href={activeNewsEvent.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:underline"
            >
              {activeNewsEvent.sourceName}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ) : (
            <span className="truncate text-zinc-400">{activeNewsEvent.sourceName}</span>
          )}
        </div>
      )}
    </section>
  );
}
