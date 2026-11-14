import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { getDemoEvent } from '../shared/demo';
import { SPAWN } from '../shared/locations';
import type { NewsEvent, SyncResult, WorldScenario } from '../shared/schema';
import { getLiveAvailability, syncLive } from './api';
import { advanceMission, canInteract, emptyMission, startMission, type MissionState } from './mission';

type Mode = 'demo' | 'live';

interface GameState {
  mode: Mode;
  liveAvailable: boolean;
  status: 'idle' | 'syncing' | 'ready' | 'error';
  error: string | null;
  news: NewsEvent | null;
  attemptedNews: NewsEvent | null;
  scenario: WorldScenario | null;
  mission: MissionState;
  player: { x: number; z: number; heading: number };
  nearby: boolean;
  resetCount: number;
  setMode: (mode: Mode) => void;
  sync: () => Promise<void>;
  checkLiveAvailability: () => Promise<void>;
  updatePosition: (x: number, z: number) => void;
  setCameraHeading: (heading: number) => void;
  interact: () => void;
  reset: () => void;
}

const initialPlayer = () => ({ ...SPAWN, heading: 0 });

export const gameState: StateCreator<GameState> = (set, get) => {
  let demoIndex = 0;
  let pending: AbortController | null = null;

  function activate({ news, scenario }: SyncResult) {
    const mission = startMission(scenario.mission.steps);
    const { x, z } = get().player;
    set({ news, scenario, mission, nearby: canInteract(mission, x, z), status: 'ready', error: null, attemptedNews: null });
  }

  return {
    mode: 'demo',
    liveAvailable: false,
    status: 'idle',
    error: null,
    news: null,
    attemptedNews: null,
    scenario: null,
    mission: emptyMission(),
    player: initialPlayer(),
    nearby: false,
    resetCount: 0,

    setMode(mode) {
      if (mode === get().mode) return;
      pending?.abort();
      pending = null;
      set({ mode, status: get().scenario ? 'ready' : 'idle', error: null, attemptedNews: null });
    },

    async sync() {
      const { mode, status, liveAvailable } = get();
      if (status === 'syncing') return;
      if (mode === 'demo') {
        activate(getDemoEvent(demoIndex++));
        return;
      }
      if (!liveAvailable) {
        set({ status: 'error', error: 'Live mode needs Gemini and Context.dev API keys. Demo mode is ready to play.' });
        return;
      }

      const request = new AbortController();
      pending = request;
      set({ status: 'syncing', error: null, attemptedNews: null });
      try {
        const response = await syncLive(request.signal);
        if (pending !== request) return;
        if (response.result) activate(response.result);
        else set({ status: 'error', error: response.error, attemptedNews: response.news ?? null });
      } catch (error) {
        if (pending !== request) return;
        const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
        set({ status: 'error', error: timedOut
          ? 'The live sync timed out. Try again or select Demo mode.'
          : 'Could not reach the live server. Try again or select Demo mode.' });
      } finally {
        if (pending === request) pending = null;
      }
    },

    async checkLiveAvailability() {
      set({ liveAvailable: await getLiveAvailability() });
    },

    updatePosition(x, z) {
      const { player, mission } = get();
      if (x === player.x && z === player.z) return;
      set({ player: { ...player, x, z }, nearby: canInteract(mission, x, z) });
    },

    setCameraHeading(heading) {
      const { player } = get();
      if (heading !== player.heading) set({ player: { ...player, heading } });
    },

    interact() {
      const { mission, player: { x, z } } = get();
      const next = advanceMission(mission, x, z);
      if (next !== mission) set({ mission: next, nearby: canInteract(next, x, z) });
    },

    reset() {
      pending?.abort();
      pending = null;
      demoIndex = 0;
      set({
        status: 'idle', error: null, news: null, attemptedNews: null, scenario: null,
        mission: emptyMission(), player: initialPlayer(), nearby: false, resetCount: get().resetCount + 1,
      });
    },
  };
};

export const useGameStore = create(gameState);
