import { GoogleGenAI } from '@google/genai';
import type { WebNewsEvent, WorldDirectorResponse } from '@webworld/shared';
import { DIRECTOR_SYSTEM_INSTRUCTION, buildDirectorUserPrompt } from './prompts.js';
import { buildDirectorJsonSchema, parseAndValidateDirectorJson } from './validator.js';

export class GeminiDirectorClient {
  private readonly apiKey: string | null;
  private readonly jsonSchema: Record<string, unknown>;

  constructor(apiKey: string | null) {
    this.apiKey = apiKey;
    this.jsonSchema = buildDirectorJsonSchema();
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generateScenario(
    newsEvent: WebNewsEvent,
    modelId: string
  ): Promise<WorldDirectorResponse> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const client = new GoogleGenAI({ apiKey: this.apiKey });

    const interaction = await client.interactions.create({
      model: modelId,
      system_instruction: DIRECTOR_SYSTEM_INSTRUCTION,
      input: buildDirectorUserPrompt(newsEvent),
      generation_config: {
        // Low thinking level keeps interactive gameplay latency snappy while preserving schema adherence
        thinking_level: 'low',
        max_output_tokens: 32768,
      },
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: this.jsonSchema,
      },
    });

    const outputText = interaction.output_text;
    if (!outputText || !outputText.trim()) {
      throw new Error(`Gemini model "${modelId}" returned an empty output_text.`);
    }

    return parseAndValidateDirectorJson(outputText);
  }
}
