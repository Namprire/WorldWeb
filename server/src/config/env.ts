import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_PRO_MODEL,
  DEFAULT_GEMINI_VIDEO_MODEL,
  resolveSupportedGeminiModel,
} from '@webworld/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env first, then optional server/.env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface ServerEnvConfig {
  port: number;
  geminiApiKey: string | null;
  contextDevApiKey: string | null;
  geminiModel: string;
  geminiProModel: string;
  geminiImageModel: string;
  geminiVideoModel: string;
  modelWarning?: string;
}

export function loadServerEnv(): ServerEnvConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || null;
  const contextDevApiKey = process.env.CONTEXT_DEV_API_KEY?.trim() || null;

  const resolvedDefault = resolveSupportedGeminiModel(
    process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  );
  const resolvedPro = resolveSupportedGeminiModel(
    process.env.GEMINI_PRO_MODEL || DEFAULT_GEMINI_PRO_MODEL
  );

  const portRaw = Number(process.env.PORT || 3001);
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 3001;

  return {
    port,
    geminiApiKey,
    contextDevApiKey,
    geminiModel: resolvedDefault.modelId,
    geminiProModel: resolvedPro.modelId,
    geminiImageModel: process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL,
    geminiVideoModel: process.env.GEMINI_VIDEO_MODEL?.trim() || DEFAULT_GEMINI_VIDEO_MODEL,
    modelWarning: resolvedDefault.warning,
  };
}
