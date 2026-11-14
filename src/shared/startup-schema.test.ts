import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  classifyHeadline, databaseSchema, emptyFilters, isHiring, matchesFilters, parseQueryLocally, recentFunding, type Startup,
} from './startup-schema'
import { MISSION_GOAL, buildConnections, missionProgress, score, tourOrder } from '../startup/logic'

const database = databaseSchema.parse(JSON.parse(readFileSync('data/startups.json', 'utf8')))
const placed = database.startups.filter((s) => s.location)

test('the shipped snapshot is valid and every fact carries a source', () => {
  assert.ok(database.startups.length >= 100)
  assert.equal(new Set(database.startups.map((s) => s.id)).size, database.startups.length, 'ids are unique')
  assert.ok(placed.length >= 20)
  for (const s of database.startups) {
    for (const fact of [s.description, s.founded, s.founders, s.employees, s.funding, s.investors, s.jobs, s.location]) {
      if (!fact) continue
      assert.ok(fact.sourceName, `${s.name} fact names its source`)
      assert.ok(!Number.isNaN(Date.parse(fact.retrievedAt)), `${s.name} fact has a retrieval date`)
    }
    for (const item of s.news) assert.match(item.url, /^https?:\/\//)
  }
})

test('placed companies stand on a real map building in Helsinki', async () => {
  // @ts-expect-error plain JavaScript map module
  const { mapData, inPolygon } = await import('../../public/engine/helsinki-geography.js')
  const buildings = new Map<string, { rings: number[][][]; bounds: number[] }>(mapData.buildings.map((b: { id: string }) => [b.id, b]))
  for (const s of placed) {
    const { x, z, buildingId, address } = s.location!
    const building = buildings.get(buildingId)
    assert.ok(building, `${s.name} references a mapped building`)
    const [w, n, e, so] = building.bounds
    assert.ok(inPolygon(x, z, building.rings) || (x > w - 18 && x < e + 18 && z > n - 18 && z < so + 18), `${s.name} sits at its building`)
    assert.equal(s.city, 'Helsinki')
    assert.ok(s.reportedAddress && address.split(' ')[0].toLowerCase() === s.reportedAddress.split(' ')[0].toLowerCase(), `${s.name} keeps its reported street`)
  }
  for (const s of database.startups.filter((c) => c.outsideDistrict)) {
    assert.equal(s.location, null, `${s.name} is outside the district and must not be placed`)
    assert.ok(s.reportedAddress && s.municipality, `${s.name} keeps its confirmed address`)
  }
})

test('headline types are keyword based', () => {
  assert.equal(classifyHeadline('Saidot Raises Undisclosed Funding'), 'funding')
  assert.equal(classifyHeadline('Supermetrics Launches Campaign Manager'), 'launch')
  assert.equal(classifyHeadline('Master Concept Partners with Supermetrics'), 'partnership')
  assert.equal(classifyHeadline('Acme appoints new CEO'), 'hiring')
  assert.equal(classifyHeadline('Wolt faces police probe'), 'other')
})

test('questions become filters without Gemini', () => {
  assert.deepEqual(parseQueryLocally('Show me AI startups in Helsinki').industries, ['ai'])
  assert.deepEqual(parseQueryLocally('Find climate-tech companies').industries, ['climate'])
  const hiring = parseQueryLocally('Which startups are hiring developers?')
  assert.equal(hiring.hiring, true)
  assert.ok(hiring.roleKeywords.includes('developer'))
  assert.equal(parseQueryLocally('Show companies that recently raised funding').recentlyFunded, true)
  assert.deepEqual(parseQueryLocally('Find startups working on healthcare').industries, ['health'])
})

test('filters only match sourced records', () => {
  const ai = placed.filter((s) => matchesFilters(s, { ...emptyFilters, industries: ['ai'] }))
  assert.ok(ai.length >= MISSION_GOAL && ai.every((s) => s.industry === 'ai'))
  const hiring = database.startups.filter((s) => matchesFilters(s, { ...emptyFilters, hiring: true }))
  assert.ok(hiring.length > 0 && hiring.every((s) => s.jobs!.value.length > 0 && s.jobs!.sourceUrl))
  const funded = database.startups.filter((s) => matchesFilters(s, { ...emptyFilters, recentlyFunded: true }))
  assert.ok(funded.every((s) => recentFunding(s)?.date))
  assert.equal(database.startups.some((s) => s.industry === 'hub' && matchesFilters(s, emptyFilters)), false)
})

test('an undated or old round is not recent funding', () => {
  const base = placed[0]
  const old: Startup = { ...base, news: [], funding: { value: { total: '€1 million', latestRound: { type: 'Seed', amount: '€1 million', date: '2019-01-01' } }, sourceUrl: null, sourceName: 'test', retrievedAt: new Date().toISOString(), status: 'sourced' } }
  assert.equal(recentFunding(old), null)
  assert.equal(recentFunding({ ...old, funding: { ...old.funding!, value: { total: null, latestRound: { type: 'Seed', amount: '€1 million', date: null } } } }), null)
})

test('every mission can be completed on the map', () => {
  for (const mission of missionProgress(database.startups, {})) {
    assert.ok(placed.filter((s) => s.industry !== 'hub' && mission.test(s)).length >= MISSION_GOAL, mission.title)
  }
  const three = placed.filter((s) => s.industry === 'ai').slice(0, 3)
  const discovered = Object.fromEntries(three.map((s) => [s.id, { at: new Date().toISOString(), street: false }]))
  assert.equal(missionProgress(database.startups, discovered).find((m) => m.id === 'ai')!.done, true)
  assert.ok(score(database.startups, discovered) >= 3 * 100 + 500)
  assert.ok(placed.filter(isHiring).length >= MISSION_GOAL)
})

test('connections separate records from suggestions', () => {
  const ids = placed.filter((s) => s.industry !== 'hub').map((s) => s.id)
  const links = buildConnections(database.startups, [
    { a: ids[0], b: ids[1], kind: 'similar', reason: 'test' },
    { a: ids[0], b: 'not-on-map', kind: 'opportunity', reason: 'test' },
  ])
  assert.equal(links.filter((l) => l.kind === 'similar').length, 1)
  assert.equal(links.filter((l) => l.kind === 'opportunity').length, 0)
  for (const link of links.filter((l) => l.kind === 'investor')) assert.match(link.reason, /named as an investor in both/)
  assert.ok(links.every((l) => ids.includes(l.a) && ids.includes(l.b) && l.a !== l.b))
})

test('every company marked for the map in the database is listed', () => {
  const sheet = JSON.parse(readFileSync('data/spreadsheet.json', 'utf8')) as { companies: Record<string, unknown>[] }
  const wanted = sheet.companies.filter((c) => /^yes/i.test(String(c['On map'])) && c.Status !== 'Closed')
  const plain = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const row of wanted) assert.ok(database.startups.some((s) => plain(s.name) === plain(String(row.Company))), `${row.Company} is listed`)
})

test('tours visit the nearest stop next', () => {
  const order = tourOrder({ x: 0, z: 0 }, [{ x: 50, z: 0 }, { x: 10, z: 0 }, { x: 30, z: 0 }])
  assert.deepEqual(order.map((p) => p.x), [10, 30, 50])
})
