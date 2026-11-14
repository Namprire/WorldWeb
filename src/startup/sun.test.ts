import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atHelsinkiTime, helsinkiMinutes, phaseOf, sunPosition } from './sun'

test('the sun follows its real path over Helsinki', () => {
  const november = new Date('2026-11-14T12:00:00Z')
  const noon = sunPosition(atHelsinkiTime(november, 12 * 60))
  assert.ok(noon.elevation > 10 && noon.elevation < 13, `mid-November noon elevation ${noon.elevation}`)
  assert.ok(Math.abs(noon.azimuth - 180) < 10, 'noon sun is due south')
  assert.ok(noon.z > 0.9 * Math.cos(noon.elevation * Math.PI / 180), 'south is +z in map space')
  assert.ok(sunPosition(atHelsinkiTime(november, 7 * 60 + 30)).elevation < 0, 'dark before eight in November')
  assert.ok(sunPosition(atHelsinkiTime(november, 16 * 60 + 30)).elevation < 0, 'dark by half past four')
  const midsummer = sunPosition(atHelsinkiTime(new Date('2026-06-21T12:00:00Z'), 13 * 60 + 20))
  assert.ok(midsummer.elevation > 52 && midsummer.elevation < 54, `midsummer noon elevation ${midsummer.elevation}`)
  assert.ok(sunPosition(atHelsinkiTime(new Date('2026-06-21T12:00:00Z'), 60)).elevation > -8, 'midsummer nights never get fully dark')
})

test('Helsinki clock conversion round-trips', () => {
  const base = new Date('2026-11-14T12:00:00Z')
  for (const minutes of [0, 9 * 60 + 30, 13 * 60, 23 * 60 + 55]) assert.equal(helsinkiMinutes(atHelsinkiTime(base, minutes)), minutes)
})

test('parts of the day', () => {
  assert.equal(phaseOf(9 * 60 + 30, 3), 'morning')
  assert.equal(phaseOf(13 * 60, 11), 'afternoon')
  assert.equal(phaseOf(16 * 60 + 15, -3), 'evening')
  assert.equal(phaseOf(22 * 60, -40), 'night')
})
