import { Component, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useGameStore } from './game/state';
import { Hud } from './hud/Hud';
import { World } from './world/World';
import './styles.css';

class WorldBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="world-error" role="alert">
      <h1>WEBWORLD</h1>
      <p>The city could not start. Enable WebGL or try a browser with hardware acceleration.</p>
      <button type="button" onClick={() => location.reload()}>Reload game</button>
    </div>;
  }
}

function App() {
  useEffect(() => {
    void useGameStore.getState().checkLiveAvailability();

    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'KeyE' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return;
      useGameStore.getState().interact();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return <main className="game">
    <WorldBoundary>
      <World />
      <Hud />
    </WorldBoundary>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
