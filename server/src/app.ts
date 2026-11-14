import express, { type Express } from 'express';
import cors from 'cors';
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_ORDER,
  NewsTopicSchema,
  OperatingModeSchema,
  SUPPORTED_GEMINI_MODELS,
  SyncRealityRequestSchema,
  type ApiErrorResponse,
  type DemoScenarioId,
  type ServerStatus,
  type SyncRealityResponse,
} from '@webworld/shared';
import type { ServerEnvConfig } from './config/env.js';
import { ContextWebService } from './live-web/contextClient.js';
import { GeminiDirectorClient } from './ai-director/geminiClient.js';
import { WorldScenarioGenerator } from './ai-director/scenarioGenerator.js';

export interface AppDependencies {
  env: ServerEnvConfig;
  contextService?: ContextWebService;
  scenarioGenerator?: WorldScenarioGenerator;
}

export function createWebWorldApp({
  env,
  contextService = new ContextWebService(env.contextDevApiKey),
  scenarioGenerator = new WorldScenarioGenerator(
    new GeminiDirectorClient(env.geminiApiKey),
    env.geminiModel
  ),
}: AppDependencies): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '256kb' }));

  let demoCursor = 0;

  // 1. Health & Capability Status
  app.get('/api/status', (_req, res) => {
    const geminiConfigured = Boolean(env.geminiApiKey);
    const contextDevConfigured = contextService.isConfigured();

    const statusPayload: ServerStatus = {
      ok: true,
      liveReady: geminiConfigured && contextDevConfigured,
      capabilities: {
        geminiConfigured,
        contextDevConfigured,
      },
      configuredModel: env.geminiModel,
      proModel: env.geminiProModel,
      supportedModels: [...SUPPORTED_GEMINI_MODELS],
      modelWarning: env.modelWarning,
    };

    res.json(statusPayload);
  });

  // 2. News Feed Retrieval (Demo Fixtures vs Live Context.dev)
  app.get('/api/news', async (req, res) => {
    const modeParsed = OperatingModeSchema.safeParse(req.query.mode ?? 'demo');
    const topicParsed = NewsTopicSchema.safeParse(req.query.topic ?? 'nvidia');

    if (!modeParsed.success || !topicParsed.success) {
      const body: ApiErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid mode or topic query parameter.',
          canUseDemoMode: true,
        },
      };
      res.status(400).json(body);
      return;
    }

    const mode = modeParsed.data;
    const topic = topicParsed.data;

    if (mode === 'demo') {
      const nowIso = new Date().toISOString();
      const events = DEMO_SCENARIO_ORDER.map((id) =>
        DEMO_SCENARIOS[id].createNewsEvent(nowIso)
      );
      res.json({ mode: 'demo', events });
      return;
    }

    // Live Mode: NEVER return simulated events disguised as live news
    if (!contextService.isConfigured()) {
      const body: ApiErrorResponse = {
        error: {
          code: 'MISSING_API_KEYS',
          message:
            'Live Mode requires CONTEXT_DEV_API_KEY on the server. Add it to .env or switch to Demo Mode.',
          missingKeys: ['CONTEXT_DEV_API_KEY'],
          canUseDemoMode: true,
        },
      };
      res.status(400).json(body);
      return;
    }

    try {
      const events = await contextService.retrieveTopicNews(topic, true);
      res.json({ mode: 'live', events });
    } catch (err) {
      console.error('[api/news] Live retrieval failed:', err);
      const body: ApiErrorResponse = {
        error: {
          code: 'CONTEXT_DEV_ERROR',
          message:
            err instanceof Error
              ? err.message
              : 'Context.dev news retrieval failed.',
          canUseDemoMode: true,
        },
      };
      res.status(502).json(body);
    }
  });

  // 3. SYNC REALITY — Retrieves headline & generates validated WorldDirectorResponse
  app.post('/api/sync-reality', async (req, res) => {
    const parsedReq = SyncRealityRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      const body: ApiErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid SYNC REALITY request payload.',
          canUseDemoMode: true,
        },
      };
      res.status(400).json(body);
      return;
    }

    const { mode, topic = 'nvidia', selectedEventId, demoScenarioId, geminiModel } =
      parsedReq.data;

    // Deterministic Demo Mode (works offline with zero API keys, clearly labeled simulated)
    if (mode === 'demo') {
      const startMs = Date.now();
      const chosenId: DemoScenarioId =
        demoScenarioId ??
        DEMO_SCENARIO_ORDER[demoCursor++ % DEMO_SCENARIO_ORDER.length];
      const scenario = DEMO_SCENARIOS[chosenId];
      const nowIso = new Date().toISOString();

      const response: SyncRealityResponse = {
        mode: 'demo',
        newsEvent: scenario.createNewsEvent(nowIso),
        director: structuredClone(scenario.director),
        meta: {
          directorSource: 'deterministic_demo',
          modelUsed: 'deterministic-demo-fixture',
          latencyMs: Math.max(1, Date.now() - startMs),
          generatedAt: nowIso,
        },
      };

      res.json(response);
      return;
    }

    // Live Mode: Verify both keys exist; NEVER substitute mock events on failure
    const missingKeys: string[] = [];
    if (!contextService.isConfigured()) missingKeys.push('CONTEXT_DEV_API_KEY');
    if (!env.geminiApiKey) missingKeys.push('GEMINI_API_KEY');

    if (missingKeys.length > 0) {
      const body: ApiErrorResponse = {
        error: {
          code: 'MISSING_API_KEYS',
          message: `Live Reality Sync requires ${missingKeys.join(
            ' and '
          )} in your server .env. Switch to Demo Mode to play simulated scenarios without credentials.`,
          missingKeys,
          canUseDemoMode: true,
        },
      };
      res.status(400).json(body);
      return;
    }

    let liveNewsEvent;
    try {
      liveNewsEvent = await contextService.selectLiveEvent(topic, selectedEventId);
    } catch (err) {
      console.error('[api/sync-reality] Context.dev error:', err);
      const body: ApiErrorResponse = {
        error: {
          code: 'CONTEXT_DEV_ERROR',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to retrieve live news from Context.dev.',
          canUseDemoMode: true,
        },
      };
      res.status(502).json(body);
      return;
    }

    try {
      const generated = await scenarioGenerator.generateLiveWorldScenario(
        liveNewsEvent,
        geminiModel
      );

      const response: SyncRealityResponse = {
        mode: 'live',
        newsEvent: liveNewsEvent,
        director: generated.director,
        meta: {
          directorSource: 'gemini_live',
          modelUsed: generated.modelUsed,
          modelWarning: generated.modelWarning,
          latencyMs: generated.latencyMs,
          generatedAt: new Date().toISOString(),
        },
      };

      res.json(response);
    } catch (err) {
      console.error('[api/sync-reality] Gemini Director error:', err);
      const body: ApiErrorResponse = {
        error: {
          code: 'GEMINI_ERROR',
          message:
            err instanceof Error
              ? err.message
              : 'Gemini World Director failed to generate a valid scenario.',
          canUseDemoMode: true,
        },
      };
      res.status(502).json(body);
    }
  });

  return app;
}
