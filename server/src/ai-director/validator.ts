import { z } from 'zod';
import {
  WorldDirectorResponseSchema,
  sanitizeWorldDirectorResponse,
  type WorldDirectorResponse,
} from '@webworld/shared';

/**
 * Converts our Zod schema into a clean JSON Schema object compatible with
 * `@google/genai` Interactions `response_format.schema`.
 */
export function buildDirectorJsonSchema(): Record<string, unknown> {
  const raw = z.toJSONSchema(WorldDirectorResponseSchema) as Record<string, unknown>;
  const clone = structuredClone(raw);
  delete clone.$schema;
  return clone;
}

function stripOptionalMarkdownFences(rawText: string): string {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

export function parseAndValidateDirectorJson(rawText: string): WorldDirectorResponse {
  const cleaned = stripOptionalMarkdownFences(rawText);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Gemini returned malformed JSON: ${err instanceof Error ? err.message : 'parse error'}`
    );
  }

  const validated = WorldDirectorResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    const issueSummary = validated.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`Gemini output failed WorldDirectorResponseSchema validation: ${issueSummary}`);
  }

  return sanitizeWorldDirectorResponse(validated.data);
}
