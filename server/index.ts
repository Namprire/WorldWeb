import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { type NewsEvent, type SyncResult } from '../src/shared/schema'
import { settings } from './config'
import { createDirector } from './director'
import { createLiveWeb } from './live-web'
import { ProviderError } from './provider-errors'

class SyncError extends Error {
  constructor(readonly failure: ProviderError, readonly news?: NewsEvent) {
    super(failure.message)
  }
}

const app = express()
app.disable('x-powered-by')

const getNews = settings.contextKey ? createLiveWeb(settings.contextKey) : undefined
const generateScenario = settings.geminiKey ? createDirector(settings.geminiKey, settings.geminiModel) : undefined
let inFlight: Promise<SyncResult> | undefined
let cache: { result: SyncResult; expires: number } | undefined

async function sync(getNews: ReturnType<typeof createLiveWeb>, generateScenario: ReturnType<typeof createDirector>) {
  let news: NewsEvent | undefined

  try {
    news = await getNews()
    const scenario = await generateScenario(news)
    const result = { news, scenario }
    cache = { result, expires: Date.now() + settings.scenarioCacheMs }
    console.info(`[WEBWORLD] Live scenario ready: ${scenario.eventType}`)
    return result
  } catch (error) {
    if (error instanceof ProviderError) throw new SyncError(error, news)
    throw error
  }
}

app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})

app.get('/api/status', (_request, response) => {
  response.json({ liveAvailable: Boolean(getNews && generateScenario) })
})

app.post('/api/sync', async (request, response) => {
  if (request.get('sec-fetch-site') === 'cross-site') {
    response.status(403).json({ error: 'Open WEBWORLD to sync reality.' })
    return
  }

  if (!getNews || !generateScenario) {
    response.status(503).json({
      error: 'Live Mode needs GEMINI_API_KEY and CONTEXT_DEV_API_KEY on the server. Demo Mode is available.',
    })
    return
  }

  if (cache && cache.expires > Date.now()) {
    response.json(cache.result)
    return
  }

  inFlight ??= sync(getNews, generateScenario).finally(() => { inFlight = undefined })
  try {
    response.json(await inFlight)
  } catch (error) {
    if (error instanceof SyncError) {
      const { failure, news } = error
      console.warn(`[WEBWORLD] Live sync failed: ${failure.provider} ${failure.reason}`)
      response.status(failure.httpStatus).json({ error: failure.message, ...(news && { news }) })
      return
    }
    console.error('[WEBWORLD] Unexpected live sync failure')
    response.status(500).json({ error: 'Live sync could not finish. Try again or switch to Demo Mode.' })
  }
})

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'Unknown API route.' })
})

const dist = resolve(import.meta.dirname, '../dist')
if (existsSync(resolve(dist, 'index.html'))) {
  app.use(express.static(dist))
}

app.listen(settings.port, settings.host, () => {
  const mode = getNews && generateScenario ? `Live Mode configured with ${settings.geminiModel}` : 'Demo Mode'
  console.info(`[WEBWORLD] API on http://${settings.host}:${settings.port} · ${mode}`)
})
