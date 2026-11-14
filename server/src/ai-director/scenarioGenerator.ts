import {
  resolveSupportedGeminiModel,
  type WebNewsEvent,
  type WorldDirectorResponse,
} from '@webworld/shared';
import { GeminiDirectorClient } from './geminiClient.js';

export interface ScenarioGenerationResult {
  director: WorldDirectorResponse;
  modelUsed: string;
  modelWarning?: string;
  latencyMs: number;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class WorldScenarioGenerator {
  private readonly geminiClient: GeminiDirectorClient;
  private readonly defaultModel: string;

  constructor(geminiClient: GeminiDirectorClient, defaultModel: string) {
    this.geminiClient = geminiClient;
    this.defaultModel = defaultModel;
  }

  async generateLiveWorldScenario(
    newsEvent: WebNewsEvent,
    requestedModel?: string
  ): Promise<ScenarioGenerationResult> {
    const startMs = Date.now();
    const resolved = resolveSupportedGeminiModel(requestedModel || this.defaultModel);

    // Attempt 1: Primary verified model
    try {
      const director = await withTimeout(
        this.geminiClient.generateScenario(newsEvent, resolved.modelId),
        25_000,
        `Gemini (${resolved.modelId})`
      );
      return {
        director,
        modelUsed: resolved.modelId,
        modelWarning: resolved.warning,
        latencyMs: Date.now() - startMs,
      };
    } catch (firstErr) {
      const fallbackModel =
        resolved.modelId === 'gemini-3.5-flash-lite'
          ? 'gemini-4-hydrogen'
          : 'gemini-3.5-flash-lite';

      console.warn(
        `[ai-director] Primary Gemini call (${resolved.modelId}) failed, retrying once with ${fallbackModel}:`,
        firstErr instanceof Error ? firstErr.message : firstErr
      );

      // Attempt 2: Retry with fast verified Gemini model (still 100% live Gemini, never fake mock)
      const director = await withTimeout(
        this.geminiClient.generateScenario(newsEvent, fallbackModel),
        22_000,
        `Gemini retry (${fallbackModel})`
      );

      const retryNote = `Primary model "${resolved.modelId}" failed (${
        firstErr instanceof Error ? firstErr.message : 'error'
      }); succeeded on retry with "${fallbackModel}".`;

      return {
        director,
        modelUsed: fallbackModel,
        modelWarning: resolved.warning ? `${resolved.warning} ${retryNote}` : retryNote,
        latencyMs: Date.now() - startMs,
      };
    }
  }
}
