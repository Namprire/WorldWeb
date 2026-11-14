import { config } from 'dotenv'

config({ quiet: true })

export const settings = {
  host: '127.0.0.1',
  port: Number(process.env.PORT || 8787),
  contextKey: process.env.CONTEXT_DEV_API_KEY?.trim(),
  geminiKey: process.env.GEMINI_API_KEY?.trim(),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
  contextTimeoutMs: 3_000,
  geminiTimeoutMs: 8_000,
  newsCacheMs: 60_000,
  scenarioCacheMs: 30_000,
}
