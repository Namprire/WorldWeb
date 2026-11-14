import ContextDev from 'context.dev'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { classifyHeadline, type NewsItem, type Startup } from '../../src/shared/startup-schema'

/**
 * Context.dev is the only source of company facts in STARTUP CITY.
 * Each helper returns data together with the URL it came from; nothing is filled in from memory.
 */

type AddressEntry = { street: string; number: string; x: number; z: number; lon: number; lat: number; building: string; osm: string }
const root = resolve(import.meta.dirname, '../..')
const addressIndex: Record<string, AddressEntry> = JSON.parse(
  readFileSync(resolve(root, 'data/helsinki-addresses.json'), 'utf8'),
).addresses

const DAY = 86_400_000
const MIN_NEWS_CONFIDENCE = 0.95

/** Match a reported street address to a building in the bundled OpenStreetMap snapshot. */
export function geocode(street: string | undefined | null) {
  if (!street) return null
  const match = street.trim().match(/^([\p{L}][\p{L} .'-]*?)\s+(\d+)(?:\s*[-\u2013]\s*\d+)?\s*([A-Za-z])?(?=$|[\s,./])/u)
  if (!match) return null
  const name = match[1].toLowerCase().replace(/\s+/g, ' ')
  const number = match[2]
  const letter = (match[3] ?? '').toLowerCase()
  const exact = addressIndex[`${name}|${number}${letter}`] ?? addressIndex[`${name}|${number}`]
  if (exact) return { entry: exact, address: `${exact.street} ${match[2]}${letter ? ` ${letter.toUpperCase()}` : ''}` }
  // Same street number with any staircase letter is still the same property.
  const key = Object.keys(addressIndex).find((k) => k.startsWith(`${name}|${number}`) && /^[a-z]?$/.test(k.slice(name.length + 1 + number.length)))
  return key ? { entry: addressIndex[key], address: `${addressIndex[key].street} ${number}` } : null
}

const clean = (value: string, limit: number) => {
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}

const httpUrl = (value: unknown) => {
  if (typeof value !== 'string') return null
  const url = URL.parse(value)
  return url && ['https:', 'http:'].includes(url.protocol) && !url.username ? url.href : null
}

export type Usage = { credits: number; remaining: number | null }

export function createContext(apiKey: string) {
  const client = new ContextDev({ apiKey, maxRetries: 1, timeout: 60_000 })
  const usage: Usage = { credits: 0, remaining: null }
  const track = (meta?: { credits_consumed: number; credits_remaining: number }) => {
    if (!meta) return
    usage.credits += meta.credits_consumed
    usage.remaining = meta.credits_remaining
  }

  /** Company profile for an official domain: description, address, size, links, logo. */
  async function profile(domain: string) {
    const response = await client.brand.retrieve({ domain, type: 'by_domain' } as never)
    track(response.key_metadata)
    const brand = response.brand
    const logos = brand.logos ?? []
    const logo = logos.find((l) => l.type === 'icon' && l.mode !== 'dark') ?? logos.find((l) => l.type === 'icon') ?? logos[0]
    const industry = brand.industries?.eic?.[0]
    return {
      name: brand.title ?? null,
      description: brand.description ? clean(brand.description, 600) : null,
      street: brand.address?.street ?? null,
      city: brand.address?.city ?? null,
      postalCode: brand.address?.postal_code ?? null,
      country: brand.address?.country_code ?? null,
      employees: brand.employees?.range ? brand.employees.range.replace(' to ', '-') : null,
      profileIndustry: industry ? industry.subindustry : null,
      linkedin: httpUrl(brand.socials?.find((s) => s.type === 'linkedin')?.url),
      careersUrl: httpUrl(brand.links?.careers),
      contactUrl: httpUrl(brand.links?.contact),
      blogUrl: httpUrl(brand.links?.blog),
      logoUrl: httpUrl(logo?.url),
      logoOnDark: logo?.mode === 'dark',
    }
  }

  /** Recent news where the company is the primary subject. */
  async function news(startup: Pick<Startup, 'id' | 'name' | 'domain'>, others: { id: string; name: string }[], days = 365): Promise<NewsItem[]> {
    // Name searches pick up same-name brands elsewhere, so news needs the official domain.
    if (!startup.domain) return []
    const now = Date.now()
    const response = await client.news.search({
      searchBy: { type: 'entity', entity: { type: 'domain', domain: startup.domain } },
      filterBy: { date: { from: now - days * DAY, to: now }, articleLanguage: ['en'] },
      sortBy: { type: 'newest' },
      limit: 25,
    })
    track(response.key_metadata)
    const retrievedAt = new Date().toISOString()
    const seen = new Set<string>()
    const items: NewsItem[] = []
    for (const article of response.data) {
      const url = httpUrl(article.url)
      // Only confident, primary-subject matches: same-name brands elsewhere score lower.
      if (!url || article.match?.level !== 'primary' || (article.match.confidence ?? 0) < MIN_NEWS_CONFIDENCE) continue
      const title = clean(article.title, 200)
      // The company must be named in the headline: this keeps unrelated matches off the map.
      if (!title.toLowerCase().includes(startup.name.toLowerCase())) continue
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 48)
      if (seen.has(key)) continue
      seen.add(key)
      const published = article.published_at ? Date.parse(article.published_at) : NaN
      items.push({
        id: `${startup.id}-${article.id}`,
        title,
        summary: article.description ? clean(article.description, 320) : null,
        url,
        sourceName: clean(article.source?.name || new URL(url).hostname.replace(/^www\./, ''), 80),
        publishedAt: Number.isFinite(published) && published <= now ? new Date(published).toISOString() : null,
        articleType: article.type,
        eventType: classifyHeadline(title),
        mentions: others
          .filter((o) => o.id !== startup.id && o.name.length > 3 && new RegExp(`\\b${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title))
          .map((o) => o.id),
        retrievedAt,
      })
      if (items.length === 6) break
    }
    return items
  }

  /** Open positions listed on the company's own careers page. */
  async function jobs(careersUrl: string) {
    const response = await client.web.scrape({
      url: careersUrl,
      formats: { json: true },
      jsonParams: {
        schema: {
          type: 'object',
          properties: {
            openings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  location: { type: ['string', 'null'] },
                  url: { type: ['string', 'null'] },
                },
                required: ['title'],
              },
            },
          },
          required: ['openings'],
        },
        instructions:
          'List only specific, currently open job positions that this page itself shows, with their exact titles. '
          + 'Do not list departments, teams, generic "open application" entries or navigation links. Return an empty list when the page shows no specific openings.',
      },
      timeoutOpts: { milliseconds: 45_000, behavior: 'fail' },
    })
    track(response.key_metadata)
    const data = response.json?.data as { openings?: unknown } | null
    if (!response.json?.success || !data || !Array.isArray(data.openings)) return null
    const seen = new Set<string>()
    return data.openings.flatMap((raw) => {
      const item = raw as { title?: unknown; location?: unknown; url?: unknown }
      if (typeof item.title !== 'string') return []
      const title = clean(item.title, 100)
      if (title.length < 4 || seen.has(title.toLowerCase()) || /open application|general application|talent (pool|community)/i.test(title)) return []
      seen.add(title.toLowerCase())
      const link = typeof item.url === 'string' ? URL.parse(item.url, careersUrl) : null
      return [{
        title,
        location: typeof item.location === 'string' && item.location.trim() ? clean(item.location, 60) : null,
        url: link && ['https:', 'http:'].includes(link.protocol) ? link.href : null,
      }]
    }).slice(0, 12)
  }

  /** Founders, founding year and funding, researched on the public web with cited pages. */
  async function facts(name: string, domain: string) {
    const response = await client.web.answers({
      mode: 'fast',
      task: `Research the company ${name} (${domain}), based in Helsinki, Finland. Report only publicly documented facts: `
        + 'founding year, founders, total publicly reported funding, the latest funding round and notable investors. '
        + 'Give the page that documents each group of facts. Use null for anything that is not publicly documented; never estimate.',
      json_format: {
        founded_year: 2016,
        founders: ['Full Name'],
        founding_source_url: 'https://…',
        total_funding: '€100 million',
        latest_round: { type: 'Series B', amount: '€40 million', date: '2023-03-01' },
        investors: ['Investor name'],
        funding_source_url: 'https://…',
      },
      timeoutOpts: { milliseconds: 55_000, behavior: 'fail' },
    })
    track(response.key_metadata)
    const j = response.json_content as Record<string, unknown>
    const names = (value: unknown) => Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 1 && !/full name|investor name/i.test(v)).map((v) => clean(v, 60)).slice(0, 8)
      : []
    const text = (value: unknown, limit = 60) => typeof value === 'string' && value.trim() && !/^(null|unknown|n\/a|not (publicly )?(available|disclosed|documented))$/i.test(value.trim()) ? clean(value, limit) : null
    const round = j.latest_round && typeof j.latest_round === 'object' ? j.latest_round as Record<string, unknown> : null
    const year = typeof j.founded_year === 'number' && j.founded_year > 1980 && j.founded_year <= new Date().getFullYear() ? j.founded_year : null
    const fallback = response.sources.map(httpUrl).find(Boolean) ?? null
    return {
      founded: year,
      founders: names(j.founders),
      foundingSource: httpUrl(j.founding_source_url) ?? fallback,
      totalFunding: text(j.total_funding, 200),
      latestRound: round ? { type: text(round.type, 40), amount: text(round.amount, 40), date: text(round.date, 20) } : null,
      investors: names(j.investors),
      fundingSource: httpUrl(j.funding_source_url) ?? fallback,
    }
  }

  /** Ask Context.dev to watch a page and report semantic changes. */
  async function watch(name: string, url: string) {
    const monitor = await client.monitors.create({
      name: `Startup City: ${name}`,
      target: { type: 'page', url, instructions: 'Report new company announcements, funding news, product launches and new job openings.' },
      schedule: { type: 'interval', frequency: 1, unit: 'days' },
      tags: ['startup-city'],
    })
    track(monitor.key_metadata)
    return { id: monitor.id, status: monitor.status, nextRunAt: monitor.next_run_at ?? null }
  }

  async function watchChanges() {
    const response = await client.monitors.listAccountChanges({ limit: 20 } as never)
    return response
  }

  return { profile, news, jobs, facts, watch, watchChanges, usage }
}

export type Context = ReturnType<typeof createContext>

const sourceName = (url: string | null, fallback: string) => {
  const host = url ? URL.parse(url)?.hostname.replace(/^www\./, '') : null
  return host ?? fallback
}

/** Merge a fresh news + jobs reading into a stored record. Failures keep the previous values. */
export async function refreshSignals(context: Context, startup: Startup, others: { id: string; name: string }[]) {
  const now = new Date().toISOString()
  const next: Startup = structuredClone(startup)
  const errors: string[] = []
  const [news, jobs] = await Promise.allSettled([
    context.news(startup, others),
    startup.careersUrl ? context.jobs(startup.careersUrl) : Promise.resolve(null),
  ])
  if (news.status === 'fulfilled') {
    next.news = news.value
    next.newsCheckedAt = now
  } else errors.push('news')
  if (jobs.status === 'fulfilled') {
    if (jobs.value && startup.careersUrl) {
      next.jobs = { value: jobs.value, sourceUrl: startup.careersUrl, sourceName: sourceName(startup.careersUrl, startup.domain ?? startup.name), retrievedAt: now, status: 'sourced' }
    }
  } else errors.push('jobs')
  if (errors.length < 2) next.updatedAt = now
  return { startup: next, errors }
}

export { sourceName }
