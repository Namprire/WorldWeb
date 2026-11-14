import { z } from 'zod';
import { NewsTopicSchema, WebNewsEventSchema } from './news.js';
import { WorldDirectorResponseSchema } from './world.js';

export const OperatingModeSchema = z.enum(['demo', 'live']);
export type OperatingMode = z.infer<typeof OperatingModeSchema>;

export const DemoScenarioIdSchema = z.enum([
  'robot_uprising',
  'gpu_market_crash',
  'tech_breakthrough',
]);
export type DemoScenarioId = z.infer<typeof DemoScenarioIdSchema>;

export const SyncRealityRequestSchema = z.object({
  mode: OperatingModeSchema,
  topic: NewsTopicSchema.optional(),
  selectedEventId: z.string().optional(),
  demoScenarioId: DemoScenarioIdSchema.optional(),
  geminiModel: z.string().optional(),
});
export type SyncRealityRequest = z.infer<typeof SyncRealityRequestSchema>;

export const SyncRealityResponseSchema = z.object({
  mode: OperatingModeSchema,
  newsEvent: WebNewsEventSchema,
  director: WorldDirectorResponseSchema,
  meta: z.object({
    directorSource: z.enum(['gemini_live', 'deterministic_demo']),
    modelUsed: z.string(),
    modelWarning: z.string().optional(),
    latencyMs: z.number(),
    generatedAt: z.string(),
  }),
});
export type SyncRealityResponse = z.infer<typeof SyncRealityResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'MISSING_API_KEYS',
      'CONTEXT_DEV_ERROR',
      'GEMINI_ERROR',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ]),
    message: z.string(),
    missingKeys: z.array(z.string()).optional(),
    canUseDemoMode: z.boolean(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;

export const ServerStatusSchema = z.object({
  ok: z.boolean(),
  liveReady: z.boolean(),
  capabilities: z.object({
    geminiConfigured: z.boolean(),
    contextDevConfigured: z.boolean(),
  }),
  configuredModel: z.string(),
  proModel: z.string(),
  supportedModels: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      tier: z.enum(['fast', 'pro', 'legacy']),
      description: z.string(),
    })
  ),
  modelWarning: z.string().optional(),
});
export type ServerStatus = z.infer<typeof ServerStatusSchema>;
