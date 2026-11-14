import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { DEMO_SCENARIOS } from '@webworld/shared';
import { normalizeContextSearchItems } from '../live-web/normalizer.js';
import { LiveEventCache } from '../live-web/eventCache.js';
import {
  buildDirectorJsonSchema,
  parseAndValidateDirectorJson,
} from '../ai-director/validator.js';
import { createWebWorldApp } from '../app.js';

/**
 * Lightweight in-memory Express request invoker so route tests work even inside
 * network-restricted CI sandboxes without opening TCP sockets.
 */
async function invokeExpressJson(
  app: ReturnType<typeof createWebWorldApp>,
  method: 'GET' | 'POST',
  url: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const req = Object.assign(new EventEmitter(), {
      method,
      url,
      originalUrl: url,
      headers: {
        'content-type': 'application/json',
      },
      body,
      // Pre-mark body as parsed for express.json() when injected in-memory
      _body: body !== undefined,
      connection: {},
      socket: {},
    });

    let statusCode = 200;
    const headers: Record<string, string> = {};
    let payload = '';

    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader(k: string, v: string) {
        headers[k.toLowerCase()] = String(v);
        return this;
      },
      getHeader(k: string) {
        return headers[k.toLowerCase()];
      },
      removeHeader(k: string) {
        delete headers[k.toLowerCase()];
      },
      status(code: number) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      write(chunk: string | Buffer) {
        payload += chunk.toString();
        return true;
      },
      end(chunk?: string | Buffer) {
        if (chunk) payload += chunk.toString();
        try {
          resolve({
            status: statusCode,
            json: payload ? JSON.parse(payload) : null,
          });
        } catch (err) {
          reject(err);
        }
        return this;
      },
    });

    (app as unknown as (req: unknown, res: unknown, next: (err?: unknown) => void) => void)(
      req,
      res,
      (err) => {
        if (err) reject(err);
      }
    );
  });
}

describe('Live Web normalizer & cache', () => {
  it('normalizes Context.dev articles with live_web provenance and domain source attribution', () => {
    const events = normalizeContextSearchItems(
      [
        {
          url: 'https://www.reuters.com/technology/nvidia-unveils-next-gen-gpu-2026-11-10/',
          title: 'NVIDIA unveils next-generation tensor superchip for AI factories',
          description: 'CEO Jensen Huang presented the new architecture on stage.',
          published_at: '2026-11-10T14:30:00Z',
          source: 'Reuters',
        },
      ],
      'nvidia',
      '2026-11-14T03:00:00.000Z'
    );

    expect(events).toHaveLength(1);
    expect(events[0].provenance).toBe('live_web');
    expect(events[0].sourceName).toBe('Reuters');
    expect(events[0].sourceUrl).toContain('reuters.com');
    expect(events[0].publishedAt).toBe('2026-11-10T14:30:00.000Z');
  });

  it('rotates cached live events across consecutive SYNC REALITY calls', () => {
    const cache = new LiveEventCache();
    const events = normalizeContextSearchItems(
      [
        {
          url: 'https://techcrunch.com/2026/11/12/ai-story-one',
          title: 'First major AI robotics story in downtown lab',
          description: 'Summary one for robotics.',
        },
        {
          url: 'https://theverge.com/2026/11/12/ai-story-two',
          title: 'Second major AI semiconductor announcement',
          description: 'Summary two for semiconductors.',
        },
      ],
      'artificial_intelligence'
    );

    cache.setTopicEvents('artificial_intelligence', events);
    const first = cache.pickNextEvent(events);
    const second = cache.pickNextEvent(events);
    expect(first?.id).not.toBe(second?.id);
  });
});

describe('AI Director JSON validator & Express API honesty guarantees', () => {
  it('exports clean JSON schema without $schema and validates structured Gemini JSON', () => {
    const schema = buildDirectorJsonSchema();
    expect(schema.$schema).toBeUndefined();
    expect(schema.type).toBe('object');

    const raw = JSON.stringify(DEMO_SCENARIOS.gpu_market_crash.director);
    const validated = parseAndValidateDirectorJson(`\`\`\`json\n${raw}\n\`\`\``);
    expect(validated.event_type).toBe('gpu_market_crash');
    expect(validated.world_changes.traffic_mode).toBe('chaos');
  });

  it('rejects unknown/unsafe world commands or out-of-range robot spawns', () => {
    const bad = {
      ...structuredClone(DEMO_SCENARIOS.robot_uprising.director),
      event_type: 'execute_arbitrary_js',
    };
    expect(() => parseAndValidateDirectorJson(JSON.stringify(bad))).toThrow();
  });

  it('serves deterministic Demo Mode and refuses silent mock substitution in Live Mode when keys are missing', async () => {
    const app = createWebWorldApp({
      env: {
        port: 3001,
        geminiApiKey: null,
        contextDevApiKey: null,
        geminiModel: 'gemini-4-hydrogen',
        geminiProModel: 'gemini-4-carbon',
        geminiImageModel: 'gemini-nano-banana-2.1',
        geminiVideoModel: 'gemini-omni-1.2-flash',
      },
    });

    // 1. Demo Mode works out-of-the-box with simulated provenance
    const demoRes = await invokeExpressJson(app, 'POST', '/api/sync-reality', {
      mode: 'demo',
      demoScenarioId: 'robot_uprising',
    });
    expect(demoRes.status).toBe(200);
    expect(demoRes.json.mode).toBe('demo');
    expect(demoRes.json.newsEvent.provenance).toBe('simulated_demo');
    expect(demoRes.json.newsEvent.sourceUrl).toBeNull();
    expect(demoRes.json.director.event_type).toBe('robot_uprising');

    // 2. Live Mode returns explicit MISSING_API_KEYS error rather than faking live news
    const liveRes = await invokeExpressJson(app, 'POST', '/api/sync-reality', {
      mode: 'live',
      topic: 'nvidia',
    });
    expect(liveRes.status).toBe(400);
    expect(liveRes.json.error.code).toBe('MISSING_API_KEYS');
    expect(liveRes.json.error.missingKeys).toContain('GEMINI_API_KEY');
    expect(liveRes.json.error.missingKeys).toContain('CONTEXT_DEV_API_KEY');
  });
});
