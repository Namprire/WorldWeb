import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { settings } from './config'
import { registerStartupRoutes } from './startups/routes'

const app = express()
app.disable('x-powered-by')
// Behind Cloud Run's proxy the visitor's address is in X-Forwarded-For.
app.set('trust proxy', 1)

app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})

registerStartupRoutes(app)

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'Unknown API route.' })
})

const dist = resolve(import.meta.dirname, '../dist')
if (existsSync(resolve(dist, 'index.html'))) {
  app.use(express.static(dist))
}

app.listen(settings.port, settings.host, () => {
  const mode = settings.contextKey ? 'Context.dev live signals enabled' : 'saved data only'
  console.info(`[Startup City] API on http://${settings.host}:${settings.port}, ${mode}`)
})
