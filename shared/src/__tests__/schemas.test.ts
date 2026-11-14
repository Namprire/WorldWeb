import { describe, expect, it } from 'vitest';
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_ORDER,
  WebNewsEventSchema,
  WorldDirectorResponseSchema,
  resolveSupportedGeminiModel,
  sanitizeWorldDirectorResponse,
} from '../index.js';

describe('@webworld/shared schemas and fixtures', () => {
  it('validates all deterministic Demo Mode fixtures cleanly', () => {
    for (const id of DEMO_SCENARIO_ORDER) {
      const scenario = DEMO_SCENARIOS[id];
      const news = scenario.createNewsEvent('2026-11-14T03:00:00.000Z');

      const parsedNews = WebNewsEventSchema.parse(news);
      expect(parsedNews.provenance).toBe('simulated_demo');
      expect(parsedNews.sourceUrl).toBeNull();
      expect(parsedNews.headline).toContain('[SIMULATED DEMO]');

      const parsedDirector = WorldDirectorResponseSchema.parse(scenario.director);
      expect(parsedDirector.event_type).toBe(id);
    }
  });

  it('rejects simulated demo events that try to impersonate live URLs', () => {
    const result = WebNewsEventSchema.safeParse({
      id: 'bad-demo',
      headline: 'Fake article',
      summary: 'Pretending to be real news.',
      sourceUrl: 'https://example.com/news',
      sourceName: 'Fake',
      publishedAt: null,
      retrievedAt: new Date().toISOString(),
      topic: 'nvidia',
      provenance: 'simulated_demo',
    });
    expect(result.success).toBe(false);
  });

  it('rejects live web events missing sourceUrl attribution', () => {
    const result = WebNewsEventSchema.safeParse({
      id: 'bad-live',
      headline: 'Live article without URL',
      summary: 'Missing attribution link.',
      sourceUrl: null,
      sourceName: 'Tech Site',
      publishedAt: null,
      retrievedAt: new Date().toISOString(),
      topic: 'nvidia',
      provenance: 'live_web',
    });
    expect(result.success).toBe(false);
  });

  it('resolves supported Gemini models and replaces deprecated models safely', () => {
    expect(resolveSupportedGeminiModel('gemini-4-hydrogen').modelId).toBe('gemini-4-hydrogen');
    expect(resolveSupportedGeminiModel('gemini-4-carbon').modelId).toBe('gemini-4-carbon');
    expect(resolveSupportedGeminiModel('gemini-3.5-flash-lite').modelId).toBe('gemini-3.5-flash-lite');

    const deprecated = resolveSupportedGeminiModel('gemini-2.0-flash');
    expect(deprecated.modelId).toBe('gemini-4-hydrogen');
    expect(deprecated.substitutedFrom).toBe('gemini-2.0-flash');
    expect(deprecated.warning).toBeDefined();
  });

  it('clamps and normalizes WorldDirectorResponse values within safe engine limits', () => {
    const base = structuredClone(DEMO_SCENARIOS.robot_uprising.director);
    base.world_changes.billboard_text = '  ai alert downtown  ';
    const sanitized = sanitizeWorldDirectorResponse(base);
    expect(sanitized.world_changes.billboard_text).toBe('AI ALERT DOWNTOWN');
  });
});
