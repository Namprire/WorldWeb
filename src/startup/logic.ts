import {
  INDUSTRIES, isHiring, recentFunding, type IndustryId, type Startup, type Suggestion,
} from '../shared/startup-schema'

export type ConnectionKind = 'investor' | 'partnership' | 'industry' | 'similar' | 'opportunity'

export const CONNECTION_KINDS: Record<ConnectionKind, { label: string; color: string; inferred: boolean; hint: string }> = {
  investor: { label: 'Shared investor', color: '#c084fc', inferred: false, hint: 'Both funding records name the same investor' },
  partnership: { label: 'Announced together', color: '#fbbf24', inferred: false, hint: 'A sourced headline names both companies' },
  industry: { label: 'Same industry', color: '#22d3ee', inferred: false, hint: 'Same editorial category, nearest neighbour' },
  similar: { label: 'Similar product', color: '#f472b6', inferred: true, hint: 'Suggested by Gemini from the two profiles' },
  opportunity: { label: 'Possible opportunity', color: '#4ade80', inferred: true, hint: 'Suggested by Gemini from the two profiles' },
}

export type Connection = {
  kind: ConnectionKind
  a: string
  b: string
  /** What the link is based on, shown to the user. */
  reason: string
  sourceUrl: string | null
}

// Unnamed groups and public funding agencies say little about how two companies relate.
const GENERIC_INVESTORS = /^(angel investors?|business angels?|undisclosed.*|private investors?|founders?|management|existing investors?|other investors?|business finland|tekes|finnvera|european investment bank.*|eib|european innovation council.*|eic.*|european union|eu)$/i
const investorKey = (name: string) => name.toLowerCase().replace(/\.(vc|com|io|fi)$/, '').replace(/\b(ventures?|capital|partners|oy|ltd|inc|management|vc)\b/g, '').replace(/[^a-z0-9]+/g, '')

/** Relationships between mapped companies. Verified kinds come straight from sourced records. */
export function buildConnections(startups: Startup[], suggestions: Suggestion[]): Connection[] {
  const placed = startups.filter((s) => s.location && s.industry !== 'hub')
  const byId = new Map(placed.map((s) => [s.id, s]))
  const links: Connection[] = []
  const seen = new Set<string>()
  const add = (link: Connection) => {
    const key = `${link.kind}|${[link.a, link.b].sort().join('|')}`
    if (link.a === link.b || seen.has(key)) return
    seen.add(key)
    links.push(link)
  }

  const investors = new Map<string, { label: string; companies: Startup[] }>()
  for (const s of placed) for (const name of s.investors?.value ?? []) {
    if (GENERIC_INVESTORS.test(name.trim())) continue
    const key = investorKey(name)
    if (key.length < 3) continue
    if (!investors.has(key)) investors.set(key, { label: name, companies: [] })
    const entry = investors.get(key)!
    if (!entry.companies.includes(s)) entry.companies.push(s)
  }
  for (const { label, companies } of investors.values()) {
    // A portfolio is drawn as a chain through its companies rather than every pair.
    const chain = [...companies].sort((x, y) => x.location!.x - y.location!.x)
    for (let i = 1; i < chain.length; i++) {
      const others = chain.filter((c) => c !== chain[i - 1] && c !== chain[i]).map((c) => c.name)
      add({ kind: 'investor', a: chain[i - 1].id, b: chain[i].id, reason: `${label} is named as an investor in both${others.length ? ` (also in ${others.join(', ')})` : ''}`, sourceUrl: chain[i].investors?.sourceUrl ?? null })
    }
  }

  for (const s of placed) for (const item of s.news) for (const other of item.mentions) {
    if (byId.has(other)) add({ kind: 'partnership', a: s.id, b: other, reason: item.title, sourceUrl: item.url })
  }

  // One link to the nearest company in the same category keeps the industry layer readable.
  for (const s of placed) {
    let nearest: Startup | null = null, distance = Infinity
    for (const other of placed) {
      if (other === s || other.industry !== s.industry || other.location!.buildingId === s.location!.buildingId) continue
      const d = Math.hypot(other.location!.x - s.location!.x, other.location!.z - s.location!.z)
      if (d < distance) { distance = d; nearest = other }
    }
    if (nearest) add({ kind: 'industry', a: s.id, b: nearest.id, reason: `Both are categorised as ${INDUSTRIES[s.industry].label}`, sourceUrl: null })
  }

  for (const suggestion of suggestions) {
    if (byId.has(suggestion.a) && byId.has(suggestion.b)) add({ kind: suggestion.kind, a: suggestion.a, b: suggestion.b, reason: suggestion.reason, sourceUrl: null })
  }
  return links
}

export type MissionId = 'ai' | 'hiring' | 'funded'
export const MISSIONS: { id: MissionId; title: string; brief: string; badge: string; test: (s: Startup) => boolean }[] = [
  { id: 'ai', title: 'Find 3 AI startups in Helsinki', brief: 'Visit companies in the AI & Data category.', badge: 'AI Scout', test: (s) => s.industry === 'ai' },
  { id: 'hiring', title: 'Discover 3 startups currently hiring', brief: 'Visit companies whose careers page lists open positions.', badge: 'Talent Spotter', test: isHiring },
  { id: 'funded', title: 'Find 3 recently funded companies', brief: 'Visit companies with a dated, sourced funding round in the last 18 months.', badge: 'Deal Hunter', test: (s) => Boolean(recentFunding(s)) },
]
export const MISSION_GOAL = 3
export const POINTS = { discovery: 100, street: 50, mission: 500 }

export type Discovery = { at: string; street: boolean }

export function missionProgress(startups: Startup[], discovered: Record<string, Discovery>) {
  const visited = startups.filter((s) => discovered[s.id] && s.industry !== 'hub')
  return MISSIONS.map((mission) => {
    const found = visited.filter(mission.test)
    return { ...mission, found, count: Math.min(found.length, MISSION_GOAL), done: found.length >= MISSION_GOAL }
  })
}

export function score(startups: Startup[], discovered: Record<string, Discovery>) {
  const ids = Object.keys(discovered).filter((id) => startups.some((s) => s.id === id))
  const missions = missionProgress(startups, discovered).filter((m) => m.done).length
  return ids.length * POINTS.discovery + ids.filter((id) => discovered[id].street).length * POINTS.street + missions * POINTS.mission
}

export function badges(startups: Startup[], discovered: Record<string, Discovery>) {
  const progress = missionProgress(startups, discovered)
  const visited = startups.filter((s) => discovered[s.id])
  const campus = visited.filter((s) => s.location?.address.startsWith('Lapinlahdenkatu 16') && s.industry !== 'hub').length
  return [
    ...progress.map((m) => ({ name: m.badge, earned: m.done, how: m.title })),
    { name: 'Street Explorer', earned: visited.some((s) => discovered[s.id].street), how: 'Visit a startup at street level' },
    { name: 'Maria 01 Regular', earned: campus >= 3, how: 'Discover 3 companies on the Maria 01 campus' },
    { name: 'Industry Tourist', earned: new Set(visited.filter((s) => s.industry !== 'hub').map((s) => s.industry)).size >= 5, how: 'Discover companies in 5 categories' },
  ]
}

export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return 'date not given'
  const time = Date.parse(iso)
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : iso
}

export const relativeDate = (iso: string | null) => {
  if (!iso) return ''
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return formatDate(iso)
}

export const industryColor = (id: IndustryId) => INDUSTRIES[id].color

/** Visit order for a tour: always the nearest unvisited stop. */
export function tourOrder<T extends { x: number; z: number }>(start: { x: number; z: number }, stops: T[]) {
  const left = [...stops], order: T[] = []
  let at = start
  while (left.length) {
    let best = 0
    for (let i = 1; i < left.length; i++) {
      if (Math.hypot(left[i].x - at.x, left[i].z - at.z) < Math.hypot(left[best].x - at.x, left[best].z - at.z)) best = i
    }
    at = left[best]
    order.push(left.splice(best, 1)[0])
  }
  return order
}
