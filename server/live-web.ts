import ContextDev from 'context.dev'
import { z } from 'zod'
import { newsEventSchema, type NewsEvent } from '../src/shared/schema'
import { settings } from './config'
import { ProviderError, requestProvider } from './provider-errors'

const DAY_MS = 24 * 60 * 60 * 1_000
const NEWS_WINDOW_MS = 7 * DAY_MS

const providerArticleSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  url: z.string(),
  source: z.object({ name: z.string().optional() }).optional(),
})

function plainText(value: string, limit: number) {
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}

export function selectNews(value: unknown, now: Date): NewsEvent {
  const page = z.object({ data: z.array(z.unknown()) }).safeParse(value)
  if (!page.success) throw new ProviderError('Context.dev', 'unavailable')

  for (const result of page.data.data) {
    const article = providerArticleSchema.safeParse(result)
    if (!article.success) continue

    const { id, title, description, published_at: publishedAt, url, source } = article.data
    const sourceUrl = URL.parse(url)
    if (!sourceUrl || !['https:', 'http:'].includes(sourceUrl.protocol) || sourceUrl.username || sourceUrl.password) continue
    const published = publishedAt ? Date.parse(publishedAt) : NaN
    if (Number.isFinite(published) && (published < now.getTime() - NEWS_WINDOW_MS || published > now.getTime())) continue

    const news = newsEventSchema.safeParse({
      id: `live-${id}`,
      mode: 'live',
      headline: plainText(title, 160),
      summary: plainText(description ?? '', 320) || 'The publisher did not supply a summary. Open the source for details.',
      sourceName: plainText(source?.name || sourceUrl.hostname.replace(/^www\./, ''), 80),
      sourceUrl: sourceUrl.href,
      publishedAt: Number.isFinite(published) ? new Date(published).toISOString() : null,
      retrievedAt: now.toISOString(),
    })
    if (news.success) return news.data
  }

  throw new ProviderError('Context.dev', 'empty')
}

export function createLiveWeb(apiKey: string) {
  const context = new ContextDev({ apiKey, maxRetries: 0, timeout: settings.contextTimeoutMs })
  let cache: { news: NewsEvent; expires: number } | undefined

  return async function getNews(): Promise<NewsEvent> {
    if (cache && cache.expires > Date.now()) return cache.news

    const news = await requestProvider('Context.dev', settings.contextTimeoutMs, async (signal) => {
      const now = Date.now()
      const response = await context.news.search({
        searchBy: {
          type: 'natural_language',
          query: 'Recent reporting about NVIDIA, AI breakthroughs, robotics, GPU supply and markets, and major announcements from technology companies',
        },
        filterBy: { date: { from: now - NEWS_WINDOW_MS, to: now }, articleLanguage: ['en'] },
        limit: 10,
      }, { signal })
      return selectNews(response, new Date())
    })
    cache = { news, expires: Date.now() + settings.newsCacheMs }
    return news
  }
}
