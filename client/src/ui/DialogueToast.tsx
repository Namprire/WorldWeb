import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../state/gameStore';

export function DialogueToast() {
  const dialogueFeed = useGameStore((s) => s.dialogueFeed);
  const bannerAlert = useGameStore((s) => s.bannerAlert);
  const dismissBanner = useGameStore((s) => s.dismissBanner);

  useEffect(() => {
    if (!bannerAlert) return;
    const timer = setTimeout(() => {
      dismissBanner();
    }, 5000);
    return () => clearTimeout(timer);
  }, [bannerAlert, dismissBanner]);

  const primaryLine = dialogueFeed[0];

  return (
    <div className="pointer-events-none my-auto flex flex-col items-center justify-between gap-6">
      {/* Classic GTA V Widescreen Translucent Black + Gold `MISSION PASSED` / `REALITY SYNCED` Banner */}
      {bannerAlert && (
        <div className="pointer-events-auto relative flex w-full max-w-2xl flex-col items-center justify-center border-y border-amber-400/45 bg-gradient-to-r from-transparent via-zinc-950/92 to-transparent px-8 py-4 text-center shadow-2xl">
          <button
            type="button"
            onClick={dismissBanner}
            className="absolute top-2 right-6 text-zinc-400 hover:text-white"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="text-[10px] font-black tracking-[0.25em] text-zinc-300 uppercase">
            {bannerAlert.provenance === 'live_web'
              ? 'LIVE INTERNET REALITY SYNCED'
              : 'SIMULATED DEMO SCENARIO ACTIVE'}
          </div>
          <div className="gta-cash-shadow mt-0.5 text-2xl font-black tracking-wider text-amber-400 uppercase sm:text-3xl">
            {bannerAlert.title}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-zinc-100">
            {bannerAlert.subtitle}
          </div>
        </div>
      )}

      {/* Clean GTA V Bottom-Center Cinematic Subtitle Caption */}
      {primaryLine && !bannerAlert && (
        <div className="gta-subtitle-shadow mt-auto max-w-xl rounded bg-zinc-950/45 px-4 py-1.5 text-center backdrop-blur-[2px]">
          <span
            className={`mr-1.5 text-xs font-extrabold uppercase ${
              primaryLine.speaker.toLowerCase().includes('jensen')
                ? 'text-amber-300'
                : 'text-sky-300'
            }`}
          >
            {primaryLine.speaker}:
          </span>
          <span className="text-sm font-medium text-white">
            {primaryLine.text}
          </span>
        </div>
      )}
    </div>
  );
}
