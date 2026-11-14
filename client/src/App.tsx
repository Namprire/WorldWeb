import { useEffect } from 'react';
import { WorldCanvas } from './game-engine/WorldCanvas';
import { GameHud } from './ui/GameHud';
import { useGameStore } from './state/gameStore';

export function App() {
  const initialize = useGameStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050712]">
      <WorldCanvas />
      <GameHud />
    </main>
  );
}
