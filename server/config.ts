import { config } from 'dotenv'

config({ quiet: true })

export const settings = {
  host: '127.0.0.1',
  port: Number(process.env.PORT || 8787),
  contextKey: process.env.CONTEXT_DEV_API_KEY?.trim(),
  geminiKey: process.env.GEMINI_API_KEY?.trim(),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
  // STARTUP CITY: fast interpretation, per-company research answers, ecosystem-wide analysis.
  geminiModels: {
    fast: process.env.GEMINI_MODEL_FAST?.trim() || 'gemini-4-hydrogen',
    research: process.env.GEMINI_MODEL_RESEARCH?.trim() || 'gemini-4-carbon',
    deep: process.env.GEMINI_MODEL_DEEP?.trim() || 'gemini-4-argon',
  },
  contextTimeoutMs: 3_000,
  geminiTimeoutMs: 8_000,
  newsCacheMs: 60_000,
  scenarioCacheMs: 30_000,
}
