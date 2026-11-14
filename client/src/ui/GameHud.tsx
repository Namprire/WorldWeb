import { TopBar } from './TopBar';
import { MissionTracker } from './MissionTracker';
import { LiveInternetPanel } from './LiveInternetPanel';
import { Minimap } from './Minimap';
import { DialogueToast } from './DialogueToast';
import { AiDebugDrawer } from './AiDebugDrawer';

export function GameHud() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3.5 sm:p-5">
      {/* Top Row: Left GTA V Help/Mission Box + Right Wanted Stars, Cash & Director Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <MissionTracker />
        <TopBar />
      </div>

      {/* Center Cinematic GTA V Banner Overlay */}
      <DialogueToast />

      {/* Bottom Row: Bottom-Left GTA V GPS Radar + Bottom-Right iFruit Smartphone (`LIVE INTERNET` & `SYNC REALITY`) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Minimap />
        <div className="flex items-end gap-2.5">
          <AiDebugDrawer />
          <LiveInternetPanel />
        </div>
      </div>
    </div>
  );
}
