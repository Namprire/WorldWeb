import { create } from 'zustand';
import {
  CITY_LANDMARKS,
  DEFAULT_GEMINI_MODEL,
  DEMO_SCENARIOS,
  DEMO_SCENARIO_ORDER,
  INITIAL_WORLD_CHANGES,
  SUPPORTED_GEMINI_MODELS,
  type DemoScenarioId,
  type DialogueLine,
  type EventType,
  type GeminiModelOption,
  type MissionSpec,
  type NewsTopic,
  type OperatingMode,
  type ServerStatus,
  type SkyColorPreset,
  type SyncRealityResponse,
  type WebNewsEvent,
  type WorldChanges,
  type WorldDirectorResponse,
} from '@webworld/shared';
import {
  SyncApiError,
  fetchNewsFeed,
  fetchServerStatus,
  requestSyncReality,
} from '../services/apiClient';
import { addCameraTrauma, triggerWorldShockwave } from './playerTelemetry';

export interface SkyPalette {
  skyHex: string;
  horizonHex: string;
  sunHex: string;
  fogHex: string;
  hemiSkyHex: string;
  hemiGroundHex: string;
  keyLightHex: string;
  neonAccentHex: string;
  fogDensity: number;
}

export const SKY_PALETTES: Record<SkyColorPreset, SkyPalette> = {
  cyber_night: {
    skyHex: '#1b3b6f',
    horizonHex: '#eb8c54',
    sunHex: '#ffe0b2',
    fogHex: '#c48367',
    hemiSkyHex: '#93c5fd',
    hemiGroundHex: '#574c46',
    keyLightHex: '#ffd7a8',
    neonAccentHex: '#f59e0b',
    fogDensity: 0.0038,
  },
  red: {
    skyHex: '#2a0910',
    horizonHex: '#b91c1c',
    sunHex: '#fca5a5',
    fogHex: '#69191e',
    hemiSkyHex: '#f87171',
    hemiGroundHex: '#3b181c',
    keyLightHex: '#fecaca',
    neonAccentHex: '#ef4444',
    fogDensity: 0.0065,
  },
  amber_crash: {
    skyHex: '#331a0b',
    horizonHex: '#d97706',
    sunHex: '#fde68a',
    fogHex: '#7c3f16',
    hemiSkyHex: '#fbbf24',
    hemiGroundHex: '#452715',
    keyLightHex: '#fed7aa',
    neonAccentHex: '#f97316',
    fogDensity: 0.006,
  },
  electric_blue: {
    skyHex: '#1d4ed8',
    horizonHex: '#bae6fd',
    sunHex: '#fffbeb',
    fogHex: '#9ec5e8',
    hemiSkyHex: '#bfdbfe',
    hemiGroundHex: '#64748b',
    keyLightHex: '#fffbeb',
    neonAccentHex: '#38bdf8',
    fogDensity: 0.0028,
  },
  neon_purple: {
    skyHex: '#28164a',
    horizonHex: '#d946ef',
    sunHex: '#f5d0fe',
    fogHex: '#6b3b7a',
    hemiSkyHex: '#d8b4fe',
    hemiGroundHex: '#3b2d4a',
    keyLightHex: '#f3e8ff',
    neonAccentHex: '#c084fc',
    fogDensity: 0.0046,
  },
  emerald_surge: {
    skyHex: '#134e4a',
    horizonHex: '#6ee7b7',
    sunHex: '#ecfdf5',
    fogHex: '#598c82',
    hemiSkyHex: '#a7f3d0',
    hemiGroundHex: '#3f524c',
    keyLightHex: '#fef3c7',
    neonAccentHex: '#84cc16',
    fogDensity: 0.0034,
  },
};

export type SyncLifecycleStatus =
  | 'idle'
  | 'fetching_news'
  | 'directing_world'
  | 'synced'
  | 'error';

export interface ActiveMissionState {
  spec: MissionSpec;
  status: 'active' | 'completed';
  distanceMeters: number;
  completedAt?: string;
}

export interface GameStoreState {
  // Connectivity & mode
  mode: OperatingMode;
  serverOnline: boolean;
  serverStatus: ServerStatus | null;
  selectedModel: string;
  supportedModels: readonly GeminiModelOption[];
  selectedTopic: NewsTopic;

  // Demo scenario cycling
  demoCycleIndex: number;
  selectedDemoScenario: DemoScenarioId | 'cycle';

  // Live / Demo news feed
  newsFeed: WebNewsEvent[];
  selectedNewsId: string | null;
  activeNewsEvent: WebNewsEvent | null;

  // World Director state
  activeEventType: EventType | null;
  worldChanges: WorldChanges;
  activeMission: ActiveMissionState | null;
  dialogueFeed: DialogueLine[];
  lastDirectorResponse: WorldDirectorResponse | null;
  lastSyncMeta: SyncRealityResponse['meta'] | null;

  // Player score & UI panels
  computeTflops: number;
  missionsCompleted: number;
  syncStatus: SyncLifecycleStatus;
  syncError: {
    code: string;
    message: string;
    missingKeys?: string[];
    canUseDemoMode: boolean;
  } | null;
  debugOpen: boolean;
  bannerAlert: {
    title: string;
    subtitle: string;
    accent: string;
    provenance: 'live_web' | 'simulated_demo';
  } | null;

  // Actions
  initialize: () => Promise<void>;
  setMode: (mode: OperatingMode) => Promise<void>;
  setSelectedModel: (modelId: string) => void;
  setSelectedTopic: (topic: NewsTopic) => Promise<void>;
  setSelectedDemoScenario: (choice: DemoScenarioId | 'cycle') => void;
  selectNewsItem: (id: string) => void;
  refreshNewsFeed: () => Promise<void>;
  syncReality: () => Promise<void>;
  applySyncPayload: (payload: SyncRealityResponse) => void;
  updateMissionDistance: (distanceMeters: number) => void;
  completeActiveMission: () => void;
  toggleDebugDrawer: () => void;
  dismissBanner: () => void;
  clearError: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  mode: 'demo',
  serverOnline: false,
  serverStatus: null,
  selectedModel: DEFAULT_GEMINI_MODEL,
  supportedModels: SUPPORTED_GEMINI_MODELS,
  selectedTopic: 'nvidia',

  demoCycleIndex: 0,
  selectedDemoScenario: 'cycle',

  newsFeed: DEMO_SCENARIO_ORDER.map((id) => DEMO_SCENARIOS[id].createNewsEvent()),
  selectedNewsId: null,
  activeNewsEvent: null,

  activeEventType: null,
  worldChanges: { ...INITIAL_WORLD_CHANGES },
  activeMission: null,
  dialogueFeed: [
    {
      speaker: 'Jensen',
      text: 'Welcome to Los Silicon! Walk, sprint, press F to drive any supercar, V for eye-view, or hit SYNC REALITY on your iFruit feed!',
    },
  ],
  lastDirectorResponse: null,
  lastSyncMeta: null,

  computeTflops: 420,
  missionsCompleted: 0,
  syncStatus: 'idle',
  syncError: null,
  debugOpen: false,
  bannerAlert: null,

  initialize: async () => {
    try {
      const status = await fetchServerStatus();
      const initialMode: OperatingMode = status.liveReady ? 'live' : 'demo';
      set({
        serverOnline: true,
        serverStatus: status,
        mode: initialMode,
        selectedModel: status.configuredModel || DEFAULT_GEMINI_MODEL,
        supportedModels: status.supportedModels,
      });
      await get().refreshNewsFeed();
    } catch {
      const nowIso = new Date().toISOString();
      set({
        serverOnline: false,
        mode: 'demo',
        newsFeed: DEMO_SCENARIO_ORDER.map((id) => DEMO_SCENARIOS[id].createNewsEvent(nowIso)),
      });
    }
  },

  setMode: async (mode) => {
    set({ mode, syncError: null, selectedNewsId: null });
    await get().refreshNewsFeed();
  },

  setSelectedModel: (modelId) => {
    set({ selectedModel: modelId });
  },

  setSelectedTopic: async (topic) => {
    set({ selectedTopic: topic, syncError: null });
    if (get().mode === 'live') {
      await get().refreshNewsFeed();
    }
  },

  setSelectedDemoScenario: (choice) => {
    set({ selectedDemoScenario: choice });
  },

  selectNewsItem: (id) => {
    set((state) => ({
      selectedNewsId: state.selectedNewsId === id ? null : id,
    }));
  },

  refreshNewsFeed: async () => {
    const { mode, selectedTopic } = get();
    set({ syncStatus: 'fetching_news', syncError: null });
    try {
      const events = await fetchNewsFeed(mode, selectedTopic);
      set({
        newsFeed: events,
        syncStatus: 'idle',
      });
    } catch (err) {
      const apiErr =
        err instanceof SyncApiError
          ? {
              code: err.code,
              message: err.message,
              missingKeys: err.missingKeys,
              canUseDemoMode: err.canUseDemoMode,
            }
          : {
              code: 'INTERNAL_ERROR',
              message: err instanceof Error ? err.message : 'Failed to load news feed.',
              canUseDemoMode: true,
            };
      set({
        newsFeed: mode === 'live' ? [] : get().newsFeed,
        syncStatus: 'error',
        syncError: apiErr,
      });
    }
  },

  syncReality: async () => {
    const state = get();
    if (
      state.syncStatus === 'fetching_news' ||
      state.syncStatus === 'directing_world'
    ) {
      return;
    }

    set({ syncStatus: 'directing_world', syncError: null });

    let demoScenarioId: DemoScenarioId | undefined;
    if (state.mode === 'demo') {
      if (state.selectedDemoScenario !== 'cycle') {
        demoScenarioId = state.selectedDemoScenario;
      } else if (state.selectedNewsId) {
        const match = DEMO_SCENARIO_ORDER.find(
          (id) => DEMO_SCENARIOS[id].createNewsEvent().id === state.selectedNewsId
        );
        demoScenarioId = match ?? DEMO_SCENARIO_ORDER[state.demoCycleIndex % DEMO_SCENARIO_ORDER.length];
      } else {
        demoScenarioId =
          DEMO_SCENARIO_ORDER[state.demoCycleIndex % DEMO_SCENARIO_ORDER.length];
      }
    }

    try {
      const response = await requestSyncReality({
        mode: state.mode,
        topic: state.selectedTopic,
        selectedEventId: state.mode === 'live' ? state.selectedNewsId ?? undefined : undefined,
        demoScenarioId,
        geminiModel: state.selectedModel,
      });

      get().applySyncPayload(response);
    } catch (err) {
      const apiErr =
        err instanceof SyncApiError
          ? {
              code: err.code,
              message: err.message,
              missingKeys: err.missingKeys,
              canUseDemoMode: err.canUseDemoMode,
            }
          : {
              code: 'INTERNAL_ERROR',
              message: err instanceof Error ? err.message : 'SYNC REALITY failed.',
              canUseDemoMode: true,
            };
      set({
        syncStatus: 'error',
        syncError: apiErr,
      });
    }
  },

  applySyncPayload: (payload) => {
    triggerWorldShockwave(0.8);

    const landmark = CITY_LANDMARKS[payload.director.mission.target_landmark];
    const palette = SKY_PALETTES[payload.director.world_changes.sky_color];

    set((state) => {
      // Prepend live event into feed if not already present
      const exists = state.newsFeed.some((n) => n.id === payload.newsEvent.id);
      const updatedFeed = exists
        ? state.newsFeed.map((n) => (n.id === payload.newsEvent.id ? payload.newsEvent : n))
        : [payload.newsEvent, ...state.newsFeed].slice(0, 8);

      return {
        syncStatus: 'synced',
        syncError: null,
        demoCycleIndex:
          payload.mode === 'demo' ? state.demoCycleIndex + 1 : state.demoCycleIndex,
        newsFeed: updatedFeed,
        activeNewsEvent: payload.newsEvent,
        activeEventType: payload.director.event_type,
        worldChanges: { ...payload.director.world_changes },
        activeMission: {
          spec: payload.director.mission,
          status: 'active',
          distanceMeters: Math.round(
            Math.hypot(landmark.beaconPosition[0], landmark.beaconPosition[2])
          ),
        },
        dialogueFeed: payload.director.dialogue,
        lastDirectorResponse: payload.director,
        lastSyncMeta: payload.meta,
        bannerAlert: {
          title: payload.director.mission.title,
          subtitle: `${landmark.name} — ${payload.director.mission.objective}`,
          accent: palette.neonAccentHex,
          provenance: payload.newsEvent.provenance,
        },
      };
    });
  },

  updateMissionDistance: (distanceMeters) => {
    const current = get().activeMission;
    if (!current || current.status !== 'active') return;
    const rounded = Math.round(distanceMeters);
    if (Math.abs(current.distanceMeters - rounded) >= 1) {
      set({
        activeMission: {
          ...current,
          distanceMeters: rounded,
        },
      });
    }
  },

  completeActiveMission: () => {
    const current = get().activeMission;
    if (!current || current.status === 'completed') return;

    addCameraTrauma(0.55);

    set((state) => ({
      computeTflops: state.computeTflops + current.spec.reward_tflops,
      missionsCompleted: state.missionsCompleted + 1,
      activeMission: {
        ...current,
        status: 'completed',
        distanceMeters: 0,
        completedAt: new Date().toISOString(),
      },
      dialogueFeed: [
        {
          speaker: 'Jensen',
          text: `Mission complete! +${current.spec.reward_tflops} TFLOPS added to the sovereign AI grid. Press SYNC REALITY for the next headline!`,
        },
        ...state.dialogueFeed.slice(0, 2),
      ],
      bannerAlert: {
        title: 'MISSION ACCOMPLISHED',
        subtitle: `+${current.spec.reward_tflops} TFLOPS // ${current.spec.title}`,
        accent: '#76b900',
        provenance: state.activeNewsEvent?.provenance ?? 'simulated_demo',
      },
    }));
  },

  toggleDebugDrawer: () => set((s) => ({ debugOpen: !s.debugOpen })),
  dismissBanner: () => set({ bannerAlert: null }),
  clearError: () => set({ syncError: null, syncStatus: 'idle' }),
}));
