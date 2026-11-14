import { z } from 'zod'

/**
 * STARTUP CITY data contract, shared by the Express API and the browser.
 *
 * Every displayed fact carries its provenance:
 *  - verified   : structured data read directly from a source (company profile, news metadata, OSM)
 *  - sourced    : extracted by the Context.dev research agent, with the page it cited
 *  - ai-summary : text written by Gemini from the facts above
 *  - ai-inferred: a suggestion computed or inferred, never presented as fact
 */
export const factStatusSchema = z.enum(['verified', 'sourced', 'ai-summary', 'ai-inferred'])
export type FactStatus = z.infer<typeof factStatusSchema>

const provenance = {
  sourceUrl: z.string().nullable(),
  sourceName: z.string(),
  retrievedAt: z.string(),
  status: factStatusSchema,
}

const fact = <T extends z.ZodType>(value: T) => z.object({ value, ...provenance })

export const INDUSTRIES = {
  ai: { label: 'AI & Data', short: 'AI & Data', color: '#22d3ee' },
  devtools: { label: 'Cloud & Developer Tools', short: 'Cloud & Dev', color: '#60a5fa' },
  climate: { label: 'Climate & Energy', short: 'Climate', color: '#4ade80' },
  health: { label: 'Health', short: 'Health', color: '#fb7185' },
  fintech: { label: 'Fintech', short: 'Fintech', color: '#facc15' },
  gaming: { label: 'Gaming', short: 'Gaming', color: '#c084fc' },
  commerce: { label: 'Commerce & Delivery', short: 'Commerce', color: '#fb923c' },
  deeptech: { label: 'Deep Tech & Space', short: 'Deep Tech', color: '#a78bfa' },
  martech: { label: 'Marketing & Sales Tech', short: 'Marketing', color: '#f472b6' },
  proptech: { label: 'Property & Travel', short: 'Property', color: '#2dd4bf' },
  saas: { label: 'Business Software', short: 'Software', color: '#93c5fd' },
  hub: { label: 'Startup Hub', short: 'Hub', color: '#e2e8f0' },
  partner: { label: 'Junction 2026 partner', short: 'Partners', color: '#f5c96a' },
} as const
export type IndustryId = keyof typeof INDUSTRIES
export const industryIds = Object.keys(INDUSTRIES) as [IndustryId, ...IndustryId[]]

export const eventTypeSchema = z.enum(['funding', 'hiring', 'launch', 'partnership', 'other'])
export type EventType = z.infer<typeof eventTypeSchema>

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  url: z.string(),
  sourceName: z.string(),
  publishedAt: z.string().nullable(),
  articleType: z.string(),
  eventType: eventTypeSchema,
  /** Other mapped companies named in the headline. */
  mentions: z.array(z.string()),
  retrievedAt: z.string(),
})
export type NewsItem = z.infer<typeof newsItemSchema>

export const jobSchema = z.object({
  title: z.string(),
  location: z.string().nullable(),
  url: z.string().nullable(),
})

export const locationSchema = z.object({
  address: z.string(),
  postalCode: z.string().nullable(),
  /** Local metres, X east / Z south, same projection as the 3D map. */
  x: z.number(),
  z: z.number(),
  lon: z.number(),
  lat: z.number(),
  buildingId: z.string(),
  osmId: z.string(),
  ...provenance,
})

export const startupSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Null when neither the database nor a company profile gives an official site. */
  domain: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.enum(industryIds),
  /** Industry label reported by the Context.dev company profile. */
  profileIndustry: z.string().nullable(),
  logo: z.string().nullable(),
  /** True when the logo is drawn for dark backgrounds. */
  logoOnDark: z.boolean().optional(),
  city: z.string().nullable(),
  /** Reported street address, also kept when it could not be matched to a map building. */
  reportedAddress: z.string().nullable(),
  /** Municipality of the address when it was confirmed in an address register. */
  municipality: z.string().nullable().optional(),
  /** True when the address exists but lies outside the modelled 3D district. */
  outsideDistrict: z.boolean().optional(),
  /** Active or Acquired, from the company database. */
  companyStatus: z.string().nullable().optional(),
  acquirer: z.string().nullable().optional(),
  /** Junction 2026 partner tier and official logo, from the event site. */
  partner: z.object({ tier: z.string(), logo: z.string().nullable(), source: z.string() }).optional(),
  /** Headquarters city reported by the company profile, for partners based elsewhere. */
  headquarters: z.string().nullable().optional(),
  /** Where this company entered the list. */
  listedIn: z.array(z.string()).optional(),
  location: locationSchema.nullable(),
  description: fact(z.string()).nullable(),
  founded: fact(z.number()).nullable(),
  founders: fact(z.array(z.string())).nullable(),
  employees: fact(z.string()).nullable(),
  funding: fact(z.object({
    total: z.string().nullable(),
    latestRound: z.object({ type: z.string().nullable(), amount: z.string().nullable(), date: z.string().nullable() }).nullable(),
  })).nullable(),
  investors: fact(z.array(z.string())).nullable(),
  linkedin: z.string().nullable(),
  careersUrl: z.string().nullable(),
  jobs: fact(z.array(jobSchema)).nullable(),
  news: z.array(newsItemSchema),
  newsCheckedAt: z.string().nullable(),
  updatedAt: z.string(),
})
export type Startup = z.infer<typeof startupSchema>

export const databaseSchema = z.object({
  meta: z.object({
    generatedAt: z.string(),
    note: z.string(),
  }),
  startups: z.array(startupSchema),
})
export type StartupDatabase = z.infer<typeof databaseSchema>

/** Structured filters produced from a natural-language question. */
export const searchFiltersSchema = z.object({
  industries: z.array(z.enum(industryIds)),
  hiring: z.boolean(),
  recentlyFunded: z.boolean(),
  hasNews: z.boolean(),
  /** Free-text terms matched against names, descriptions and job titles. */
  keywords: z.array(z.string().max(40)).max(6),
  /** Terms matched only against open job titles. */
  roleKeywords: z.array(z.string().max(40)).max(6),
  /** Only Junction 2026 partners. */
  partners: z.boolean().optional(),
})
export type SearchFilters = z.infer<typeof searchFiltersSchema>

export const emptyFilters: SearchFilters = {
  industries: [], hiring: false, recentlyFunded: false, hasNews: false, keywords: [], roleKeywords: [],
}

const DAY = 86_400_000
export const RECENT_FUNDING_DAYS = 548
export const RECENT_NEWS_DAYS = 120

export function isHiring(s: Startup) {
  return Boolean(s.jobs && s.jobs.value.length > 0)
}

/** A funding round counts as recent only when a dated source says so. */
export function recentFunding(s: Startup, now = Date.now()) {
  const article = s.news.find((n) => n.eventType === 'funding' && n.publishedAt && now - Date.parse(n.publishedAt) < RECENT_FUNDING_DAYS * DAY)
  if (article) return { label: article.title, url: article.url, date: article.publishedAt }
  const round = s.funding?.value.latestRound
  const date = round?.date ? Date.parse(round.date) : NaN
  if (round && Number.isFinite(date) && now - date < RECENT_FUNDING_DAYS * DAY) {
    return { label: [round.type, round.amount].filter(Boolean).join(', ') || 'Funding round', url: s.funding!.sourceUrl, date: round.date }
  }
  return null
}

export function recentNews(s: Startup, now = Date.now()) {
  return s.news.filter((n) => n.publishedAt && now - Date.parse(n.publishedAt) < RECENT_NEWS_DAYS * DAY)
}

export function matchesFilters(s: Startup, f: SearchFilters, now = Date.now()) {
  if (s.industry === 'hub') return false
  if (f.partners && !s.partner) return false
  if (f.industries.length && !f.industries.includes(s.industry)) return false
  if (f.hiring && !isHiring(s)) return false
  if (f.recentlyFunded && !recentFunding(s, now)) return false
  if (f.hasNews && !recentNews(s, now).length) return false
  if (f.roleKeywords.length) {
    const titles = (s.jobs?.value ?? []).map((j) => j.title.toLowerCase())
    if (!f.roleKeywords.some((k) => titles.some((t) => t.includes(k.toLowerCase())))) return false
  }
  if (f.keywords.length) {
    const text = [s.name, s.description?.value, s.profileIndustry, INDUSTRIES[s.industry].label, ...(s.jobs?.value ?? []).map((j) => j.title)]
      .filter(Boolean).join(' ').toLowerCase()
    if (!f.keywords.some((k) => text.includes(k.toLowerCase()))) return false
  }
  return true
}

export function filtersActive(f: SearchFilters) {
  return Boolean(f.partners) || f.industries.length > 0 || f.hiring || f.recentlyFunded || f.hasNews || f.keywords.length > 0 || f.roleKeywords.length > 0
}

const EVENT_RULES: [EventType, RegExp][] = [
  ['funding', /\b(rais(es|ed|ing)|funding|financing|series [a-f]\b|seed round|pre-seed|secures? (€|\$|£|eur|usd)|investment round|valuation|ipo\b|backed by)/i],
  ['partnership', /\b(partner(s|ship|ed|ing)?( with)?|teams? up|collaborat\w+|joins forces|alliance|integrat(es|ion) with|signs? (deal|agreement)|acquir\w+|merger)\b/i],
  ['hiring', /\b(hir(es|ing|ed)|appoints?|names? new|joins as|new (ceo|cto|cfo|coo|cmo|chief)|recruit\w+|expands? team|opens? (new )?office)\b/i],
  ['launch', /\b(launch(es|ed|ing)?|unveils?|introduc(es|ed|ing)|releases? (its|the|a|version|v\d)|rolls? out|debuts?|announces? new|now available|general availability)\b/i],
]

/** Transparent keyword classification of a headline. Not a model judgement. */
export function classifyHeadline(title: string): EventType {
  for (const [type, rule] of EVENT_RULES) if (rule.test(title)) return type
  return 'other'
}

const INDUSTRY_WORDS: [IndustryId, RegExp][] = [
  ['ai', /\b(ai|a\.i\.|artificial intelligence|machine learning|ml|llm|data science|analytics)\b/i],
  ['climate', /\b(climate|clean ?tech|energy|sustainab\w*|green|carbon|circular|ev charging)\b/i],
  ['health', /\b(health\w*|medical|med ?tech|wellbeing|well-being|bio ?tech|diagnostic\w*|pharma\w*)\b/i],
  ['fintech', /\b(fin ?tech|bank\w*|payments?|finance|financial|insur\w*)\b/i],
  ['gaming', /\b(gam(e|es|ing)|esports?)\b/i],
  ['devtools', /\b(developer tools?|dev ?tools|cloud|infrastructure|open[- ]source|devops|hosting)\b/i],
  ['commerce', /\b(e-?commerce|commerce|marketplaces?|delivery|food|retail|consumer)\b/i],
  ['deeptech', /\b(deep ?tech|space|satellites?|quantum|xr|vr|ar|mixed reality|hardware|robot\w*|semiconductors?)\b/i],
  ['martech', /\b(marketing|sales tech|advertis\w*|ad ?tech|mar ?tech|lead generation)\b/i],
  ['proptech', /\b(prop ?tech|property|real estate|travel|hospitality|housing|mobility)\b/i],
  ['saas', /\b(saas|b2b software|business software|hr tech|ed ?tech|education|learning|security|legal)\b/i],
]
const ROLE_WORDS: [RegExp, string[]][] = [
  [/\b(developers?|engineers?|programmers?|software|coders?)\b/i, ['developer', 'engineer', 'software']],
  [/\b(designers?|ux|ui)\b/i, ['design', 'ux']],
  [/\b(sales|account executives?)\b/i, ['sales', 'account']],
  [/\b(marketers?|marketing)\b/i, ['marketing']],
  [/\b(data scientists?|analysts?)\b/i, ['data', 'analyst']],
  [/\b(product managers?)\b/i, ['product']],
]

/**
 * Keyword interpretation of a question. Used when Gemini is unavailable, so search keeps working offline.
 */
export function parseQueryLocally(query: string): SearchFilters {
  const hiring = /\b(hiring|hire|jobs?|recruit\w*|open (positions?|roles?)|careers?|vacanc\w*)\b/i.test(query)
  const roles = hiring ? ROLE_WORDS.filter(([rule]) => rule.test(query)).flatMap(([, words]) => words) : []
  return {
    industries: INDUSTRY_WORDS.filter(([id, rule]) => rule.test(query) && !(id === 'martech' && roles.includes('marketing'))).map(([id]) => id),
    hiring,
    recentlyFunded: /\b(fund(ing|ed|s)?|rais(ed|ing|e)|investments?|invested|series [a-f]|seed)\b/i.test(query),
    hasNews: /\b(news|announc\w*|latest|headlines?|updates?)\b/i.test(query),
    keywords: [],
    roleKeywords: [...new Set(roles)],
  }
}

/** Suggested relationships are always labelled as AI-inferred in the interface. */
export const suggestionSchema = z.object({
  a: z.string(),
  b: z.string(),
  kind: z.enum(['similar', 'opportunity']),
  reason: z.string().max(220),
})
export type Suggestion = z.infer<typeof suggestionSchema>
