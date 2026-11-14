/**
 * Builds data/startups.json, the cached snapshot shipped with STARTUP CITY.
 *
 *   node --import tsx scripts/research-startups.ts            # research everything missing
 *   node --import tsx scripts/research-startups.ts --refresh  # re-read news and jobs too
 *
 * The candidate list below only names official company domains and an editorial category.
 * Every other fact (address, description, people, funding, jobs, news, logo) is retrieved
 * through Context.dev and stored with its source URL and retrieval time. A company is placed
 * on the map only when its reported Helsinki street address matches a building in the bundled
 * OpenStreetMap snapshot; otherwise it is listed in the directory without a location.
 */
import 'dotenv/config'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createContext, geocode, refreshSignals, sourceName } from '../server/startups/context'
// @ts-expect-error The map module is plain JavaScript shared with the renderer.
import { mapData, project, inPolygon } from '../public/engine/helsinki-geography.js'
import { databaseSchema, type IndustryId, type Startup } from '../src/shared/startup-schema'

const CANDIDATES: [domain: string, industry: IndustryId, name?: string][] = [
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

const MAX_TOTAL = 50
const root = resolve(import.meta.dirname, '..')
const dataFile = resolve(root, 'data/startups.json')
const cacheFile = resolve(root, 'data/research-cache.json')
const logoDir = resolve(root, 'public/startup-logos')
mkdirSync(logoDir, { recursive: true })

if (!process.env.CONTEXT_DEV_API_KEY) throw new Error('CONTEXT_DEV_API_KEY is required to research startups.')
const context = createContext(process.env.CONTEXT_DEV_API_KEY)
const refresh = process.argv.includes('--refresh')
type Profile = Awaited<ReturnType<typeof context.profile>> & { retrievedAt: string }
type Facts = Awaited<ReturnType<typeof context.facts>> & { retrievedAt: string }
const cache: { profiles: Record<string, Profile | { error: string }>; facts: Record<string, Facts>; logos: Record<string, string> } =
  existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : { profiles: {}, facts: {}, logos: {} }
const save = () => writeFileSync(cacheFile, JSON.stringify(cache, null, 1))

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: size }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item)
  }))
}

// Phase 1 · company profiles
await pool(CANDIDATES.filter(([d]) => !cache.profiles[d]), 5, async ([domain]) => {
  try {
    cache.profiles[domain] = { ...(await context.profile(domain)), retrievedAt: new Date().toISOString() }
  } catch (error) {
    cache.profiles[domain] = { error: String((error as Error).message).slice(0, 120) }
  }
  save()
})

type Place = NonNullable<ReturnType<typeof geocode>> & { register: 'OpenStreetMap' | 'City of Helsinki address register' }
const registerCache: Record<string, Place | null> = ((cache as { register?: Record<string, Place | null> }).register ??= {})

/** Second opinion for addresses OpenStreetMap has no tag for: the City of Helsinki's open address register. */
async function helsinkiRegister(street: string): Promise<Place | null> {
  if (street in registerCache) return registerCache[street]
  const match = street.trim().match(/^([\p{L}][\p{L} .'-]*?)\s+(\d+)(?:\s*[-–\s]\s*\d+)?\s*([A-Za-z])?(?=$|[\s,./])/u)
  let place: Place | null = null
  if (match) {
    try {
      const url = new URL('https://api.hel.fi/servicemap/v2/search/')
      url.search = new URLSearchParams({ q: `${match[1]} ${match[2]}`, type: 'address', municipality: 'helsinki', page_size: '5' }).toString()
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      const results: { number: string; street: { name: { fi: string } }; location: { coordinates: [number, number] } }[] = (await response.json()).results ?? []
      const hit = results.find((r) => r.number === match[2] && r.street.name.fi.toLowerCase() === match[1].toLowerCase())
      if (hit) {
        const [lon, lat] = hit.location.coordinates
        const [x, z] = project(lon, lat) as [number, number]
        // The register point must sit on, or right beside, a mapped building footprint.
        let best: { id: string } | null = null, bestDistance = 14
        for (const b of mapData.buildings as { id: string; rings: number[][][]; bounds: number[] }[]) {
          if (x < b.bounds[0] - 15 || x > b.bounds[2] + 15 || z < b.bounds[1] - 15 || z > b.bounds[3] + 15) continue
          if (inPolygon(x, z, b.rings)) { best = b; bestDistance = 0; break }
          for (const ring of b.rings) for (let i = 0; i < ring.length; i++) {
            const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1]
            const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)))
            const d = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)
            if (d < bestDistance) { bestDistance = d; best = b }
          }
        }
        if (best) place = {
          entry: { street: hit.street.name.fi, number: hit.number, x: +x.toFixed(2), z: +z.toFixed(2), lon, lat, building: best.id, osm: 'helsinki-address-register' },
          address: `${hit.street.name.fi} ${hit.number}${match[3] ? ` ${match[3].toUpperCase()}` : ''}`,
          register: 'City of Helsinki address register',
        }
      }
    } catch { /* Unplaced companies stay in the directory. */ }
  }
  registerCache[street] = place
  save()
  return place
}

const plain = (value: string) => value.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
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

const idOf = (domain: string) => domain.replace(/\.[a-z.]+$/, '').replace(/[^a-z0-9]+/g, '-')
type Row = { domain: string; industry: IndustryId; name: string; profile: Profile; place: Place | null }
const rows: Row[] = []
for (const [domain, industry, givenName] of CANDIDATES) {
  const profile = cache.profiles[domain]
  if (!profile || 'error' in profile) { console.log(`skip ${domain}: ${profile ? profile.error : 'no profile'}`); continue }
  const inHelsinki = profile.country === 'FI' && /helsinki|helsingfors/i.test(profile.city ?? '')
  if (!inHelsinki) { console.log(`skip ${domain}: reported in ${profile.city ?? 'unknown city'}, ${profile.country ?? '?'}`); continue }
  const name = givenName ?? profile.name?.split(/\s[|–—-]\s/)[0].trim() ?? domain
  if (!givenName && !sameBrand(name, domain)) { console.log(`skip ${domain}: profile resolves to another brand (${name})`); continue }
  const osm = geocode(profile.street)
  const place: Place | null = osm ? { ...osm, register: 'OpenStreetMap' } : profile.street ? await helsinkiRegister(profile.street) : null
  rows.push({ domain, industry, name, profile, place })
}
// Placed companies first; the directory takes what remains of the budget.
rows.sort((a, b) => Number(Boolean(b.place)) - Number(Boolean(a.place)))
const selected = rows.slice(0, MAX_TOTAL)
console.log(`profiles: ${rows.length} in Helsinki, ${rows.filter((r) => r.place).length} matched to a map building; keeping ${selected.length}`)

// Profiles cached before logo contrast was recorded are read again.
await pool(selected.filter((r) => r.profile.logoOnDark === undefined), 5, async (row) => {
  try {
    const next = { ...(await context.profile(row.domain)), retrievedAt: new Date().toISOString() }
    row.profile.logoOnDark = next.logoOnDark
    ;(cache.profiles[row.domain] as Profile).logoOnDark = next.logoOnDark
  } catch { row.profile.logoOnDark = false }
  save()
})

// Phase 2 · logos, people and funding
await pool(selected, 4, async ({ domain, name, profile }) => {
  const id = idOf(domain)
  if (profile.logoUrl && !cache.logos[id]) {
    try {
      const response = await fetch(profile.logoUrl, { signal: AbortSignal.timeout(20_000) })
      const type = response.headers.get('content-type') ?? ''
      const extension = type.includes('svg') ? 'svg' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('jpeg') ? 'jpg' : null
      if (response.ok && extension) {
        writeFileSync(resolve(logoDir, `${id}.${extension}`), Buffer.from(await response.arrayBuffer()))
        cache.logos[id] = `/startup-logos/${id}.${extension}`
      }
    } catch { /* The marker falls back to initials. */ }
  }
  if (!cache.facts[domain] && domain !== 'maria.io') {
    try {
      cache.facts[domain] = { ...(await context.facts(name, domain)), retrievedAt: new Date().toISOString() }
    } catch (error) {
      console.log(`facts failed for ${domain}: ${String((error as Error).message).slice(0, 100)}`)
    }
  }
  save()
})

// Phase 3 · assemble records, then read news and careers pages
const previous: Record<string, Startup> = existsSync(dataFile)
  ? Object.fromEntries(databaseSchema.parse(JSON.parse(readFileSync(dataFile, 'utf8'))).startups.map((s) => [s.id, s]))
  : {}
const profileSource = 'Context.dev company profile'
let startups: Startup[] = selected.map(({ domain, industry, name, profile, place }) => {
  const id = idOf(domain)
  const facts = cache.facts[domain]
  const at = profile.retrievedAt
  const website = `https://${domain}`
  if (facts) facts.totalFunding = tidyFunding(facts.totalFunding)
  const funded = facts && (facts.totalFunding || facts.latestRound?.amount)
  return {
    id, name, domain, website, industry,
    profileIndustry: profile.profileIndustry,
    logo: cache.logos[id] ?? null,
    ...(cache.logos[id] && profile.logoOnDark ? { logoOnDark: true } : {}),
    city: profile.city,
    reportedAddress: profile.street,
    location: place ? {
      address: place.address, postalCode: profile.postalCode,
      x: place.entry.x, z: place.entry.z, lon: place.entry.lon, lat: place.entry.lat,
      buildingId: place.entry.building, osmId: place.entry.osm,
      sourceUrl: profile.contactUrl ?? website, sourceName: `${profileSource} · matched to ${place.register}`, retrievedAt: at, status: 'verified',
    } : null,
    description: profile.description ? { value: profile.description, sourceUrl: website, sourceName: profileSource, retrievedAt: at, status: 'verified' } : null,
    founded: facts?.founded ? { value: facts.founded, sourceUrl: facts.foundingSource, sourceName: sourceName(facts.foundingSource, 'Context.dev research'), retrievedAt: facts.retrievedAt, status: 'sourced' } : null,
    founders: facts?.founders.length ? { value: facts.founders, sourceUrl: facts.foundingSource, sourceName: sourceName(facts.foundingSource, 'Context.dev research'), retrievedAt: facts.retrievedAt, status: 'sourced' } : null,
    employees: profile.employees ? { value: profile.employees, sourceUrl: profile.linkedin ?? website, sourceName: profileSource, retrievedAt: at, status: 'verified' } : null,
    funding: funded ? { value: { total: facts.totalFunding, latestRound: facts.latestRound }, sourceUrl: facts.fundingSource, sourceName: sourceName(facts.fundingSource, 'Context.dev research'), retrievedAt: facts.retrievedAt, status: 'sourced' } : null,
    investors: facts?.investors.length ? { value: facts.investors, sourceUrl: facts.fundingSource, sourceName: sourceName(facts.fundingSource, 'Context.dev research'), retrievedAt: facts.retrievedAt, status: 'sourced' } : null,
    linkedin: profile.linkedin,
    careersUrl: profile.careersUrl,
    jobs: previous[id]?.jobs ?? null,
    news: previous[id]?.news ?? [],
    newsCheckedAt: previous[id]?.newsCheckedAt ?? null,
    updatedAt: previous[id]?.updatedAt ?? at,
  }
})

const names = startups.map(({ id, name }) => ({ id, name }))
const pending = startups.filter((s) => s.industry !== 'hub' && (refresh || !s.newsCheckedAt))
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
      note: 'Snapshot of publicly available company information retrieved through Context.dev. Locations are matched to OpenStreetMap buildings.',
    },
    startups,
  })
  writeFileSync(dataFile, JSON.stringify(database, null, 1))
  // The browser falls back to this copy when the API is unreachable.
  writeFileSync(resolve(root, 'public/data/startups-snapshot.json'), JSON.stringify(database))
}
writeDatabase()
const placed = startups.filter((s) => s.location)
console.log(`\nwrote ${startups.length} companies · ${placed.length} on the map · ${startups.length - placed.length} directory only`)
console.log(`hiring ${startups.filter((s) => s.jobs?.value.length).length} · with news ${startups.filter((s) => s.news.length).length} · funding ${startups.filter((s) => s.funding).length}`)
console.log(`Context.dev credits used: ${context.usage.credits} · remaining: ${context.usage.remaining}`)
