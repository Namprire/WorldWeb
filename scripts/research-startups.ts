/**
 * Builds data/startups.json, the company snapshot the app ships with.
 *
 *   npm run research            research companies that are new or missing data
 *   npm run research:refresh    also re-read news and careers pages for everyone
 *
 * Sources, in order of precedence:
 *  1. data/spreadsheet.json, exported from the curated company database
 *     (scripts/export-spreadsheet.py). Rows marked "On map" are included.
 *  2. The earlier list of official domains below, for companies the database
 *     does not have yet.
 * Context.dev then fills in what the database leaves empty (description, logo,
 * size, links, news, open roles). Database values win where both exist.
 *
 * A company is placed only when its street address matches a building in the
 * bundled OpenStreetMap snapshot. Addresses that exist but lie outside the 3D
 * district are kept and shown in the directory.
 */
import 'dotenv/config'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createContext, geocode, refreshSignals, sourceName } from '../server/startups/context'
// @ts-expect-error The map module is plain JavaScript shared with the renderer.
import { mapData, project, inPolygon } from '../public/engine/helsinki-geography.js'
import { databaseSchema, type IndustryId, type Startup } from '../src/shared/startup-schema'

const EARLIER_LIST: [domain: string, industry: IndustryId, name?: string][] = [
  ['maria.io', 'hub', 'Maria 01'],
  ['wolt.com', 'commerce'], ['aiven.io', 'devtools'], ['smartly.io', 'martech'], ['relexsolutions.com', 'ai'],
  ['varjo.com', 'deeptech'], ['supercell.com', 'gaming'], ['swappie.com', 'commerce'], ['yousician.com', 'saas'],
  ['silo.ai', 'ai'], ['hoxhunt.com', 'saas'], ['supermetrics.com', 'martech'], ['meruhealth.com', 'health'],
  ['nightingalehealth.com', 'health'], ['sievo.com', 'ai'], ['giosg.com', 'martech'], ['swarmia.com', 'devtools'],
  ['kodit.io', 'proptech'], ['bobw.co', 'proptech'], ['metacoregames.com', 'gaming'], ['smallgiantgames.com', 'gaming'],
  ['holvi.com', 'fintech'], ['sharetribe.com', 'commerce'], ['vainu.com', 'martech'], ['aiforia.com', 'health'],
  ['saidot.ai', 'ai'], ['valohai.com', 'ai'], ['datacrunch.io', 'ai'], ['uprightproject.com', 'ai'],
  ['algorithmiq.fi', 'deeptech'], ['happeo.com', 'saas'], ['carboculture.com', 'climate'], ['sulapac.com', 'climate'],
  ['steadyenergy.com', 'climate'], ['reorbit.space', 'deeptech'], ['flowhaven.com', 'saas'], ['virta.global', 'climate'],
  ['enfuce.com', 'fintech'], ['basemark.com', 'deeptech'], ['singa.com', 'saas'], ['leadoo.com', 'martech'],
  ['inven.ai', 'ai'], ['distance.tech', 'deeptech'], ['kaikuhealth.com', 'health'], ['combinostics.com', 'health'],
  ['gubbe.com', 'health'], ['fiksuruoka.fi', 'commerce'], ['logmore.com', 'saas'], ['cloudpermit.com', 'saas'],
  ['jobilla.com', 'saas'], ['lumoa.me', 'ai'], ['getjenny.com', 'ai'], ['dealfront.com', 'martech'],
  ['noice.com', 'gaming'], ['zefort.com', 'saas'], ['zervant.com', 'fintech'], ['onego.bio', 'climate'],
  ['nextgames.com', 'gaming'], ['futureplaygames.com', 'gaming'], ['lightheart.fi', 'gaming'], ['redhillgames.com', 'gaming'],
  ['savagegamestudios.com', 'gaming'], ['papukaya.com', 'gaming'], ['enablebanking.com', 'fintech'], ['kidescience.com', 'saas'],
  ['seppo.io', 'saas'], ['puro.earth', 'climate'], ['skipperi.fi', 'proptech'], ['resq-club.com', 'commerce'],
  ['huuva.com', 'commerce'], ['upcloud.com', 'devtools'], ['tuxera.com', 'devtools'], ['unikie.com', 'devtools'],
  ['ultimate.ai', 'ai'], ['oura.com', 'health'], ['iceye.com', 'deeptech'], ['meetiqm.com', 'deeptech'],
  ['compensate.com', 'climate'], ['whimapp.com', 'proptech'], ['yeply.com', 'commerce'], ['hailer.com', 'saas'],
  ['wellmo.com', 'health'], ['claned.com', 'saas'], ['3dbear.io', 'saas'], ['mightifier.com', 'saas'],
  ['skenariolabs.com', 'proptech'], ['sensorfleet.com', 'devtools'], ['badrap.io', 'devtools'], ['talentadore.com', 'saas'],
  ['aito.ai', 'ai'], ['veil.ai', 'ai'], ['ixi.com', 'deeptech'], ['donutlab.com', 'deeptech'],
  ['vergemotorcycles.com', 'deeptech'], ['nomagames.com', 'gaming'], ['solarfoods.com', 'climate'], ['wirepas.com', 'deeptech'],
  ['lyfta.com', 'saas'], ['framian.fi', 'ai'],
  ['thingsee.com', 'deeptech'], ['norsepower.com', 'climate'], ['zenrobotics.com', 'ai'], ['fluido.com', 'saas'],
  ['noona.com', 'health'], ['osgenic.com', 'health'], ['neuroeventlabs.com', 'health'], ['disior.com', 'health'],
  ['freska.fi', 'commerce'], ['alisapankki.fi', 'fintech'], ['mash.com', 'fintech'], ['tesseract.fi', 'deeptech'],
  ['cubicasa.com', 'proptech'], ['immersal.com', 'deeptech'], ['volur.ai', 'ai'], ['realm.fi', 'ai'],
  ['workfellow.ai', 'ai'], ['flowrite.com', 'ai'], ['speechly.com', 'ai'], ['rensoriginal.com', 'commerce'],
]

const root = resolve(import.meta.dirname, '..')
const dataFile = resolve(root, 'data/startups.json')
const cacheFile = resolve(root, 'data/research-cache.json')
const sheetFile = resolve(root, 'data/spreadsheet.json')
const logoDir = resolve(root, 'public/startup-logos')
mkdirSync(logoDir, { recursive: true })

if (!process.env.CONTEXT_DEV_API_KEY) throw new Error('CONTEXT_DEV_API_KEY is required to research startups.')
const context = createContext(process.env.CONTEXT_DEV_API_KEY)
const refresh = process.argv.includes('--refresh')
type Profile = Awaited<ReturnType<typeof context.profile>> & { retrievedAt: string }
type Facts = Awaited<ReturnType<typeof context.facts>> & { retrievedAt: string }
type RegisterHit = { street: string; number: string; lon: number; lat: number; municipality: string }
const cache: {
  profiles: Record<string, Profile | { error: string }>
  facts: Record<string, Facts>
  logos: Record<string, string>
  addresses?: Record<string, RegisterHit | null>
} = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : { profiles: {}, facts: {}, logos: {} }
cache.addresses ??= {}
const save = () => writeFileSync(cacheFile, JSON.stringify(cache, null, 1))

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: size }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item)
  }))
}

// helpers

const plain = (value: string) => value.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
const domainOf = (website: string | null | undefined) => {
  const url = website ? URL.parse(/^https?:/.test(website) ? website : `https://${website}`) : null
  return url ? url.hostname.replace(/^www\./, '').toLowerCase() : null
}
/** A profile that resolves to a different brand (an acquirer, a redirect) is not this company. */
const sameBrand = (name: string, domain: string) => {
  const label = plain(domain.split('.')[0]), brand = plain(name)
  return brand.length >= 3 && (label.includes(brand.slice(0, 4)) || brand.includes(label.slice(0, 4)))
}
const tidyFunding = (value: string | null) => {
  if (!value || /^(not |no |unknown|undisclosed|n\/a)/i.test(value)) return null
  const short = value.split(/\s*[;(]|\.\s|,\s(?!\d)|\s(?:publicly|in publicly|raised|across|over 20)/)[0].replace(/…$/, '').trim()
  return /\d/.test(short) ? short : null
}
const euros = (value: unknown) => {
  const n = typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return n >= 1e6 ? `€${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')} million` : `€${Math.round(n / 1e3)}k`
}
const list = (value: unknown) => typeof value === 'string'
  ? value.split(/\s*[,;]\s*/).map((v) => v.replace(/\s*\((co-)?founder\)/i, '').trim()).filter((v) => v.length > 1)
  : []
const firstLink = (value: unknown) => typeof value === 'string'
  ? value.split(/\s*;\s*|\s+/).find((v) => /^https?:\/\//.test(v)) ?? null
  : null
const slug = (value: string) => plain(value.replace(/\.(com|io|fi|ai|app|co|tech|space|health|global|bio|me)$/i, '')).slice(0, 40)

/** Editorial category from the database sector, tags and description, then the profile. */
const CATEGORY_RULES: [IndustryId, RegExp][] = [
  ['gaming', /\b(games?|gaming|esports?)\b/i],
  ['health', /\b(health\w*|medic\w*|pharma\w*|biotech\w*|therap\w*|diagnos\w*|clinical|patients?|dental|neuro\w*|drugs?)\b/i],
  ['climate', /\b(climate|clean ?tech|energy|nuclear|battery|batteries|carbon|renewable|sustainab\w*|circular|recycl\w*|waste|emission\w*|hydrogen|heating|solar|wind)\b/i],
  ['deeptech', /\b(space|satellites?|quantum|defen[cs]e|robot\w*|drones?|photonic\w*|semiconductor\w*|electronic components|instruments|optic\w*|xr|augmented reality|mixed reality|materials|manufactur\w*|hardware|aerospace|spacecraft)\b/i],
  ['fintech', /\b(fin ?tech|bank\w*|payments?|financial|insur\w*|lending|invoic\w*|accounting|tax|crypto\w*)\b/i],
  ['ai', /\b(ai|artificial intelligence|machine learning|llms?|computer vision|data science|ai agents?)\b/i],
  ['devtools', /\b(cloud|developer|devops|open[- ]source|hosting|infrastructure|data processing|databases?|apis?)\b/i],
  ['martech', /\b(marketing|advertis\w*|ad ?tech|sales|crm|lead generation)\b/i],
  ['commerce', /\b(e-?commerce|marketplaces?|delivery|food|retail|restaurants?|kitchens?|consumer|grocer\w*|fashion)\b/i],
  ['proptech', /\b(real estate|property|propert(y|ies)|construction|buildings?|housing|travel|hospitality|mobility|urban planning|workspace)\b/i],
]
function category(...texts: (string | null | undefined)[]): IndustryId {
  for (const text of texts) {
    if (!text) continue
    for (const [id, rule] of CATEGORY_RULES) if (rule.test(text)) return id
  }
  return 'saas'
}

// addresses

type Place = { x: number; z: number; lon: number; lat: number; building: string | null; osm: string; address: string; municipality: string; register: string }

function buildingNear(x: number, z: number) {
  let best: { id: string } | null = null, bestDistance = 14
  for (const b of mapData.buildings as { id: string; rings: number[][][]; bounds: number[] }[]) {
    if (x < b.bounds[0] - 15 || x > b.bounds[2] + 15 || z < b.bounds[1] - 15 || z > b.bounds[3] + 15) continue
    if (inPolygon(x, z, b.rings)) return b.id
    for (const ring of b.rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1]
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)))
      const d = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)
      if (d < bestDistance) { bestDistance = d; best = b }
    }
  }
  return best?.id ?? null
}

/** The open address register used by the City of Helsinki service map (covers Helsinki, Espoo and Vantaa). */
async function register(street: string): Promise<RegisterHit | null> {
  if (street in cache.addresses!) return cache.addresses![street]
  const match = street.trim().match(/^([\p{L}][\p{L} .'-]*?)\s+(\d+)/u)
  let hit: RegisterHit | null = null
  if (match) {
    for (const municipality of ['helsinki', 'espoo', 'vantaa']) {
      try {
        const url = new URL('https://api.hel.fi/servicemap/v2/search/')
        url.search = new URLSearchParams({ q: `${match[1]} ${match[2]}`, type: 'address', municipality, page_size: '5' }).toString()
        const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        const results: { number: string; street: { name: { fi: string } }; location: { coordinates: [number, number] } }[] = (await response.json()).results ?? []
        const found = results.find((r) => r.number === match[2] && r.street.name.fi.toLowerCase() === match[1].toLowerCase().trim())
        if (found) {
          hit = { street: found.street.name.fi, number: found.number, lon: found.location.coordinates[0], lat: found.location.coordinates[1], municipality: municipality[0].toUpperCase() + municipality.slice(1) }
          break
        }
      } catch { /* try the next municipality */ }
    }
  }
  cache.addresses![street] = hit
  save()
  return hit
}

async function locate(street: string | null | undefined): Promise<Place | null> {
  if (!street) return null
  const letter = street.match(/^\D+\d+\s*([A-Za-z])\b/)?.[1]
  const osm = geocode(street)
  if (osm) return { x: osm.entry.x, z: osm.entry.z, lon: osm.entry.lon, lat: osm.entry.lat, building: osm.entry.building, osm: osm.entry.osm, address: osm.address, municipality: 'Helsinki', register: 'OpenStreetMap' }
  const hit = await register(street)
  if (!hit) return null
  const [x, z] = project(hit.lon, hit.lat) as [number, number]
  const B = mapData.bounds
  const inside = x > B.west && x < B.east && z > B.north && z < B.south
  return {
    x: +x.toFixed(2), z: +z.toFixed(2), lon: hit.lon, lat: hit.lat,
    building: inside ? buildingNear(x, z) : null,
    osm: 'address-register',
    address: `${hit.street} ${hit.number}${letter ? ` ${letter.toUpperCase()}` : ''}`,
    municipality: hit.municipality,
    register: 'City of Helsinki address register',
  }
}

// candidate list

type SheetRow = Record<string, string | number | null>
type Partner = { name: string; domain: string | null; tier: string; logo: string | null }
type Candidate = { name: string; domain: string | null; industry?: IndustryId; sheet?: SheetRow; listedIn: string[]; partner?: Partner }
const sheet: { companies: SheetRow[]; fundingRounds: SheetRow[] } = JSON.parse(readFileSync(sheetFile, 'utf8'))
const candidates: Candidate[] = []
for (const row of sheet.companies) {
  if (!/^yes/i.test(String(row['On map'] ?? '')) || row.Status === 'Closed') continue
  candidates.push({ name: String(row.Company), domain: domainOf(row.Website as string), sheet: row, listedIn: ['Helsinki Startups Map database'] })
}
const fromSheet = candidates.length
for (const [domain, industry, givenName] of EARLIER_LIST) {
  const existing = candidates.find((c) => c.domain === domain || (givenName && plain(c.name) === plain(givenName)))
  if (existing) { existing.industry ??= industry; existing.listedIn.push('Earlier research list'); continue }
  candidates.push({ name: givenName ?? '', domain, industry, listedIn: ['Earlier research list'] })
}
// Junction 2026 partners, from the event site. Partners already on the list are marked; others are added.
const junction: { source: string; partners: Partner[] } = JSON.parse(readFileSync(resolve(root, 'data/junction-partners.json'), 'utf8'))
for (const partner of junction.partners) {
  const existing = candidates.find((c) => (partner.domain && c.domain === partner.domain) || plain(c.name) === plain(partner.name))
  if (existing) { existing.partner = partner; existing.listedIn.push('Junction 2026 partners'); continue }
  candidates.push({ name: partner.name, domain: partner.domain, industry: 'partner', partner, listedIn: ['Junction 2026 partners'] })
}
console.log(`candidates: ${fromSheet} from the database, ${candidates.length - fromSheet} more from the earlier list`)

// Phase 1, company profiles for every official domain
await pool(candidates.filter((c) => c.domain && !cache.profiles[c.domain]), 5, async ({ domain }) => {
  try {
    cache.profiles[domain!] = { ...(await context.profile(domain!)), retrievedAt: new Date().toISOString() }
  } catch (error) {
    cache.profiles[domain!] = { error: String((error as Error).message).slice(0, 120) }
  }
  save()
})

type Row = Candidate & { profile: Profile | null; place: Place | null; street: string | null }
const rows: Row[] = []
for (const c of candidates) {
  let profile = c.domain ? cache.profiles[c.domain] : undefined
  const usable = profile && !('error' in profile) ? profile as Profile : null
  const name = c.name || usable?.name?.split(/\s[|\u2013\u2014-]\s/)[0].trim() || c.domain || ''
  if (usable && c.domain && !sameBrand(name, c.domain) && name !== 'Maria 01') {
    if (!c.sheet && !c.partner) { console.log(`skip ${c.domain}: profile resolves to another brand (${usable.name})`); continue }
    profile = undefined
  }
  const trusted = profile && !('error' in profile) ? profile as Profile : null
  // The earlier list only knew domains, so a company can reach this point under two names.
  const key = plain(name).slice(0, 8)
  if (!c.sheet && rows.some((r) => r.sheet && (plain(r.name).startsWith(key) || key.startsWith(plain(r.name).slice(0, 8))))) continue
  if (!c.sheet && !c.partner) {
    // Earlier-list companies must report a Helsinki address themselves.
    if (!trusted || trusted.country !== 'FI' || !/helsinki|helsingfors/i.test(trusted.city ?? '')) continue
  }
  const street = (c.sheet?.['Street address'] as string | null) ?? trusted?.street ?? null
  rows.push({ ...c, name, profile: trusted, street, place: await locate(street) })
}
const placedCount = rows.filter((r) => r.place?.building).length
console.log(`${rows.length} companies, ${placedCount} matched to a 3D building, ${rows.filter((r) => r.place && !r.place.building).length} at a known address outside the district`)

// Phase 2, logos, people and funding from Context.dev, only where the database is silent
const idOf = (row: Row) => row.domain ? slug(row.domain) : slug(row.name)
await pool(rows, 4, async (row) => {
  const id = idOf(row)
  if (row.profile?.logoUrl && !cache.logos[id]) {
    try {
      const response = await fetch(row.profile.logoUrl, { signal: AbortSignal.timeout(20_000) })
      const type = response.headers.get('content-type') ?? ''
      const extension = type.includes('svg') ? 'svg' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('jpeg') ? 'jpg' : null
      if (response.ok && extension) {
        writeFileSync(resolve(logoDir, `${id}.${extension}`), Buffer.from(await response.arrayBuffer()))
        cache.logos[id] = `/startup-logos/${id}.${extension}`
      }
    } catch { /* The marker falls back to initials. */ }
  }
  const sheetHasFacts = row.sheet && (row.sheet.Founders || row.sheet['Latest round'] || row.sheet['All investors'])
  // Official Junction logos are made for dark backgrounds, which suits the partner markers.
  if (row.partner?.logo && !cache.logos[`partner-${id}`]) {
    try {
      const response = await fetch(row.partner.logo, { signal: AbortSignal.timeout(20_000) })
      const extension = row.partner.logo.split('.').pop()
      if (response.ok && extension && ['png', 'svg', 'webp', 'jpg'].includes(extension)) {
        writeFileSync(resolve(logoDir, `partner-${id}.${extension}`), Buffer.from(await response.arrayBuffer()))
        cache.logos[`partner-${id}`] = `/startup-logos/partner-${id}.${extension}`
      }
    } catch { /* the company logo is used instead */ }
  }
  if (row.domain && !cache.facts[row.domain] && row.domain !== 'maria.io' && !sheetHasFacts && row.industry !== 'partner') {
    try {
      cache.facts[row.domain] = { ...(await context.facts(row.name, row.domain)), retrievedAt: new Date().toISOString() }
    } catch (error) {
      console.log(`facts failed for ${row.domain}: ${String((error as Error).message).slice(0, 100)}`)
    }
  }
  save()
})

// Phase 3, assemble records
const previous: Record<string, Startup> = existsSync(dataFile)
  ? Object.fromEntries(databaseSchema.parse(JSON.parse(readFileSync(dataFile, 'utf8'))).startups.map((s) => [s.id, s]))
  : {}
const DB = 'Helsinki Startups Map database'
const profileSource = 'Context.dev company profile'
const used = new Set<string>()
let startups: Startup[] = rows.map((row) => {
  let id = idOf(row)
  if (row.domain === 'maria.io') id = 'maria'
  while (used.has(id)) id += '-2'
  used.add(id)
  const { profile, sheet: s, place } = row
  const now = new Date().toISOString()
  const checked = s?.['Last checked'] ? new Date(String(s['Last checked'])).toISOString() : now
  const dbLink = firstLink(s?.['Source links'])
  const dbFact = <T,>(value: T, url = dbLink) => ({ value, sourceUrl: url, sourceName: url ? sourceName(url, DB) : DB, retrievedAt: checked, status: 'sourced' as const })
  const facts = row.domain ? cache.facts[row.domain] : undefined
  if (facts) facts.totalFunding = tidyFunding(facts.totalFunding)
  const website = row.domain ? `https://${row.domain}` : null
  const at = profile?.retrievedAt ?? now

  // Funding: dated rounds from the database first, then its company row, then web research.
  const rounds = sheet.fundingRounds.filter((r) => plain(String(r.Company)) === plain(row.name))
    .sort((a, b) => String(b.Date ?? '').localeCompare(String(a.Date ?? '')))
  const latest = rounds[0]
  const sheetRound = latest
    ? { type: latest.Round && latest.Round !== 'Unknown' ? String(latest.Round) : null, amount: euros(latest['Amount (EUR)']) ?? (latest['Amount (original currency)'] ? `${latest.Currency ?? ''} ${(Number(latest['Amount (original currency)']) / 1e6).toFixed(0)} million`.trim() : null), date: latest.Date ? String(latest.Date) : null }
    : s?.['Latest round'] ? { type: String(s['Latest round']), amount: euros(s['Latest round amount (EUR)']) ?? (s['Latest round amount (original currency)'] as string | null), date: (s['Latest round date'] as string | null) ?? null } : null
  const sheetTotal = euros(s?.['Total raised (EUR)'])
  const funding = sheetRound || sheetTotal
    ? dbFact({ total: sheetTotal, latestRound: sheetRound }, (latest?.['Source link'] as string | null) ?? dbLink)
    : facts && (facts.totalFunding || facts.latestRound?.amount)
      ? { value: { total: facts.totalFunding, latestRound: facts.latestRound }, sourceUrl: facts.fundingSource, sourceName: sourceName(facts.fundingSource, 'Context.dev research'), retrievedAt: facts.retrievedAt, status: 'sourced' as const }
      : null
  const sheetInvestors = list(s?.['All investors'])
  const research = (value: unknown, url: string | null) => ({ value, sourceUrl: url, sourceName: sourceName(url, 'Context.dev research'), retrievedAt: facts!.retrievedAt, status: 'sourced' as const })

  const description = s?.['Description (one line)']
    ? dbFact(String(s['Description (one line)']))
    : profile?.description ? { value: profile.description, sourceUrl: website, sourceName: profileSource, retrievedAt: at, status: 'verified' as const } : null
  const founders = list(s?.Founders)
  const headcount = typeof s?.Headcount === 'number' ? `${s.Headcount}${s['Headcount as of'] ? ` (${s['Headcount as of']})` : ''}` : null

  return {
    id, name: row.name, domain: row.domain, website,
    // Trade-register sector codes are a last resort: they often describe the legal entity, not the product.
    industry: row.industry ?? category(s?.Tags as string, s?.['Description (one line)'] as string, profile?.profileIndustry, profile?.description, /\bAI\b/.test(row.name) ? 'AI' : null, s?.Sector as string),
    profileIndustry: profile?.profileIndustry ?? (s?.Sector as string | null) ?? null,
    logo: cache.logos[idOf(row)] ?? null,
    ...(cache.logos[idOf(row)] && profile?.logoOnDark ? { logoOnDark: true } : {}),
    city: place?.municipality ?? profile?.city ?? null,
    reportedAddress: row.street,
    municipality: place?.municipality ?? null,
    outsideDistrict: Boolean(place && !place.building),
    companyStatus: (s?.Status as string | null) ?? null,
    acquirer: (s?.Acquirer as string | null) ?? null,
    listedIn: row.listedIn,
    ...(row.partner ? { partner: { tier: row.partner.tier, logo: cache.logos[`partner-${idOf(row)}`] ?? null, source: junction.source } } : {}),
    headquarters: profile?.city ? [profile.city, profile.country].filter(Boolean).join(', ') : null,
    location: place?.building ? {
      address: place.address,
      postalCode: s?.['Postal code'] ? String(s['Postal code']).padStart(5, '0') : profile?.postalCode ?? null,
      x: place.x, z: place.z, lon: place.lon, lat: place.lat, buildingId: place.building, osmId: place.osm,
      sourceUrl: s ? 'https://www.ytj.fi/en/' : profile?.contactUrl ?? website,
      sourceName: `${s ? 'Trade register address in the database' : profileSource}, matched to ${place.register}`,
      retrievedAt: s ? checked : at, status: 'verified' as const,
    } : null,
    description,
    founded: typeof s?.Founded === 'number' ? dbFact(s.Founded) : facts?.founded ? research(facts.founded, facts.foundingSource) as Startup['founded'] : null,
    founders: founders.length ? dbFact(founders) : facts?.founders.length ? research(facts.founders, facts.foundingSource) as Startup['founders'] : null,
    employees: headcount ? dbFact(headcount) : profile?.employees ? { value: profile.employees.replace(/\u2013/g, '-'), sourceUrl: profile.linkedin ?? website, sourceName: profileSource, retrievedAt: at, status: 'verified' as const } : null,
    funding,
    investors: sheetInvestors.length ? dbFact(sheetInvestors, (latest?.['Source link'] as string | null) ?? dbLink) : facts?.investors.length ? research(facts.investors, facts.fundingSource) as Startup['investors'] : null,
    linkedin: profile?.linkedin ?? null,
    careersUrl: profile?.careersUrl ?? null,
    jobs: previous[id]?.jobs ?? null,
    news: previous[id]?.news ?? [],
    newsCheckedAt: previous[id]?.newsCheckedAt ?? null,
    updatedAt: previous[id]?.updatedAt ?? at,
  }
})

const names = startups.map(({ id, name }) => ({ id, name }))
// Large partners (Meta, NVIDIA...) are not Helsinki startups: their news would drown the local feed.
const pending = startups.filter((s) => s.industry !== 'hub' && s.industry !== 'partner' && s.domain && (refresh || !s.newsCheckedAt))
console.log(`reading news and careers pages for ${pending.length} companies`)
await pool(pending, 4, async (startup) => {
  const { startup: next, errors } = await refreshSignals(context, startup, names)
  startups = startups.map((s) => (s.id === next.id ? next : s))
  if (errors.length) console.log(`${startup.name}: ${errors.join(', ')} unavailable`)
  writeDatabase()
})

function writeDatabase() {
  const database = databaseSchema.parse({
    meta: {
      generatedAt: new Date().toISOString(),
      note: 'Companies from the Helsinki Startups Map database and earlier research, completed with public information retrieved through Context.dev. Locations are matched to OpenStreetMap buildings.',
    },
    startups,
  })
  writeFileSync(dataFile, JSON.stringify(database, null, 1))
  // The browser falls back to this copy when the API is unreachable.
  writeFileSync(resolve(root, 'public/data/startups-snapshot.json'), JSON.stringify(database))
}
writeDatabase()
const placed = startups.filter((s) => s.location)
console.log(`\nwrote ${startups.length} companies, ${placed.length} on the map, ${startups.filter((s) => s.outsideDistrict).length} outside the district, ${startups.length - placed.length - startups.filter((s) => s.outsideDistrict).length} address unknown`)
console.log(`hiring ${startups.filter((s) => s.jobs?.value.length).length}, with news ${startups.filter((s) => s.news.length).length}, funding ${startups.filter((s) => s.funding).length}`)
console.log(`Context.dev credits used: ${context.usage.credits}, remaining: ${context.usage.remaining}`)
