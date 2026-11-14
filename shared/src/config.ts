export interface GeminiModelOption {
  id: string;
  label: string;
  tier: 'fast' | 'pro' | 'legacy';
  description: string;
}

/**
 * Centralized Gemini model registry verified against the official `@google/genai`
 * `gemini-api-dev` skill. Legacy 1.5/2.0/2.5 models are deprecated and excluded.
 */
export const SUPPORTED_GEMINI_MODELS: readonly GeminiModelOption[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen (Fast)',
    tier: 'fast',
    description: 'Recommended fast daily driver for low-latency structured gameplay generation.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite (Ultra-Fast)',
    tier: 'fast',
    description: 'Lowest-latency Flash-Lite model for high-frequency world updates.',
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon (Pro / Flagship)',
    tier: 'pro',
    description: 'Configurable flagship reasoning model for richer satirical missions.',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash (Active Legacy)',
    tier: 'legacy',
    description: 'Active legacy Flash model supported for backward compatibility.',
  },
] as const;

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const DEFAULT_GEMINI_PRO_MODEL = 'gemini-4-carbon';
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-nano-banana-2.1';
export const DEFAULT_GEMINI_VIDEO_MODEL = 'gemini-omni-1.2-flash';

const DEPRECATED_PREFIXES = ['gemini-1.5', 'gemini-2.0', 'gemini-2.5', 'gemini-3.1-pro'];

export interface ResolvedModelResult {
  modelId: string;
  substitutedFrom?: string;
  warning?: string;
}

export function resolveSupportedGeminiModel(requested?: string | null): ResolvedModelResult {
  const trimmed = requested?.trim();
  if (!trimmed) {
    return { modelId: DEFAULT_GEMINI_MODEL };
  }

  if (DEPRECATED_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return {
      modelId: DEFAULT_GEMINI_MODEL,
      substitutedFrom: trimmed,
      warning: `Model "${trimmed}" is deprecated; substituted "${DEFAULT_GEMINI_MODEL}" per official Gemini SDK guidance.`,
    };
  }

  const known = SUPPORTED_GEMINI_MODELS.find((m) => m.id === trimmed);
  if (known) {
    return { modelId: known.id };
  }

  return {
    modelId: DEFAULT_GEMINI_MODEL,
    substitutedFrom: trimmed,
    warning: `Unverified model "${trimmed}"; falling back to verified "${DEFAULT_GEMINI_MODEL}".`,
  };
}

export const LANDMARK_IDS = [
  'nvidia_tower',
  'ai_headquarters',
  'wall_street_exchange',
  'keynote_arena',
  'server_farm_7',
  'quantum_harbor',
] as const;

export type LandmarkId = (typeof LANDMARK_IDS)[number];

export interface CityLandmark {
  id: LandmarkId;
  name: string;
  subtitle: string;
  position: [number, number, number];
  beaconPosition: [number, number, number];
  accentColor: string;
}

export const CITY_LANDMARKS: Record<LandmarkId, CityLandmark> = {
  nvidia_tower: {
    id: 'nvidia_tower',
    name: 'NVIDIA Tensor Spire',
    subtitle: 'Leather Jacket Command HQ',
    position: [0, 0, -31],
    beaconPosition: [0, 0, -20.5],
    accentColor: '#76b900',
  },
  ai_headquarters: {
    id: 'ai_headquarters',
    name: 'OmniMind AI Lab',
    subtitle: 'Autonomous Frontier Cluster',
    position: [28, 0, -29],
    beaconPosition: [20.5, 0, -20.5],
    accentColor: '#a855f7',
  },
  wall_street_exchange: {
    id: 'wall_street_exchange',
    name: 'Silicon Stock Exchange',
    subtitle: 'Global GPU Derivatives Floor',
    position: [-28, 0, -29],
    beaconPosition: [-20.5, 0, -20.5],
    accentColor: '#f97316',
  },
  keynote_arena: {
    id: 'keynote_arena',
    name: 'Keynote Holo-Dome',
    subtitle: 'Global Developer Launch Stage',
    position: [0, 0, 31],
    beaconPosition: [0, 0, 20.5],
    accentColor: '#06b6d4',
  },
  server_farm_7: {
    id: 'server_farm_7',
    name: 'Thermal Vault 07',
    subtitle: 'Liquid-Cooled Megawatt Pod',
    position: [28, 0, 29],
    beaconPosition: [20.5, 0, 20.5],
    accentColor: '#ec4899',
  },
  quantum_harbor: {
    id: 'quantum_harbor',
    name: 'Quantum Neon Promenade',
    subtitle: 'Westside Cybernetic Plaza',
    position: [-28, 0, 29],
    beaconPosition: [-20.5, 0, 20.5],
    accentColor: '#38bdf8',
  },
};

export const WORLD_LIMITS = {
  CITY_HALF_EXTENT: 56,
  MAX_ROBOTS: 18,
  MAX_DRONES: 14,
  MIN_FOG_DENSITY: 0.004,
  MAX_FOG_DENSITY: 0.028,
} as const;
