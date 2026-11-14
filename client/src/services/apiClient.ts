import {
  ApiErrorSchema,
  DEMO_SCENARIOS,
  ServerStatusSchema,
  SyncRealityResponseSchema,
  WebNewsEventSchema,
  type DemoScenarioId,
  type NewsTopic,
  type OperatingMode,
  type ServerStatus,
  type SyncRealityResponse,
  type WebNewsEvent,
} from '@webworld/shared';
import { z } from 'zod';

export class SyncApiError extends Error {
  readonly code: string;
  readonly missingKeys?: string[];
  readonly canUseDemoMode: boolean;

  constructor(
    message: string,
    code = 'INTERNAL_ERROR',
    canUseDemoMode = true,
    missingKeys?: string[]
  ) {
    super(message);
    this.name = 'SyncApiError';
    this.code = code;
    this.canUseDemoMode = canUseDemoMode;
    this.missingKeys = missingKeys;
  }
}

export async function fetchServerStatus(): Promise<ServerStatus> {
  const res = await fetch('/api/status');
  if (!res.ok) {
    throw new Error(`Status check failed (${res.status})`);
  }
  const json = await res.json();
  return ServerStatusSchema.parse(json);
}

const NewsFeedResponseSchema = z.object({
  mode: z.enum(['demo', 'live']),
  events: z.array(WebNewsEventSchema),
});

export async function fetchNewsFeed(
  mode: OperatingMode,
  topic?: NewsTopic
): Promise<WebNewsEvent[]> {
  const params = new URLSearchParams({ mode });
  if (topic) params.set('topic', topic);

  try {
    const res = await fetch(`/api/news?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      const parsedErr = ApiErrorSchema.safeParse(json);
      if (parsedErr.success) {
        throw new SyncApiError(
          parsedErr.data.error.message,
          parsedErr.data.error.code,
          parsedErr.data.error.canUseDemoMode,
          parsedErr.data.error.missingKeys
        );
      }
      throw new SyncApiError(`Failed to retrieve ${mode} news (${res.status})`);
    }
    return NewsFeedResponseSchema.parse(json).events;
  } catch (err) {
    if (err instanceof SyncApiError) throw err;
    // Only in Demo Mode may we serve offline deterministic demo fixtures if backend is unreachable
    if (mode === 'demo') {
      const nowIso = new Date().toISOString();
      return Object.values(DEMO_SCENARIOS).map((s) => s.createNewsEvent(nowIso));
    }
    throw new SyncApiError(
      err instanceof Error ? err.message : 'Unable to reach WEBWORLD backend server.',
      'INTERNAL_ERROR',
      true
    );
  }
}

export interface SyncRealityParams {
  mode: OperatingMode;
  topic?: NewsTopic;
  selectedEventId?: string;
  demoScenarioId?: DemoScenarioId;
  geminiModel?: string;
}

export async function requestSyncReality(
  params: SyncRealityParams
): Promise<SyncRealityResponse> {
  try {
    const res = await fetch('/api/sync-reality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const json = await res.json();
    if (!res.ok) {
      const parsedErr = ApiErrorSchema.safeParse(json);
      if (parsedErr.success) {
        throw new SyncApiError(
          parsedErr.data.error.message,
          parsedErr.data.error.code,
          parsedErr.data.error.canUseDemoMode,
          parsedErr.data.error.missingKeys
        );
      }
      throw new SyncApiError(`SYNC REALITY request failed (${res.status})`);
    }

    return SyncRealityResponseSchema.parse(json);
  } catch (err) {
    if (err instanceof SyncApiError) {
      throw err;
    }
    // Strict honesty rule: NEVER silently substitute mock data when mode === 'live'!
    if (params.mode === 'demo') {
      const scenarioId: DemoScenarioId = params.demoScenarioId ?? 'robot_uprising';
      const scenario = DEMO_SCENARIOS[scenarioId];
      const nowIso = new Date().toISOString();
      return {
        mode: 'demo',
        newsEvent: scenario.createNewsEvent(nowIso),
        director: structuredClone(scenario.director),
        meta: {
          directorSource: 'deterministic_demo',
          modelUsed: 'deterministic-demo-fixture',
          latencyMs: 12,
          generatedAt: nowIso,
        },
      };
    }
    throw new SyncApiError(
      err instanceof Error
        ? `Live backend unreachable: ${err.message}`
        : 'Live backend unreachable.',
      'INTERNAL_ERROR',
      true
    );
  }
}
