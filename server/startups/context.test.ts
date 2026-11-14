import assert from 'node:assert/strict'
import { test } from 'node:test'
import { geocode } from './context'

test('reported addresses resolve to OpenStreetMap buildings', () => {
  const maria = geocode('Lapinlahdenkatu 16 C15')
  assert.equal(maria?.address, 'Lapinlahdenkatu 16')
  assert.match(maria!.entry.building, /^(way|relation)\//)
  assert.equal(geocode('Antinkatu 1, 6th floor')?.address, 'Antinkatu 1')
  assert.equal(geocode('Elielinaukio 2G')?.address, 'Elielinaukio 2 G')
})

test('unknown, foreign or incomplete addresses are never placed', () => {
  assert.equal(geocode('Postintaival 7'), null)
  assert.equal(geocode('9 Appold Street, London'), null)
  assert.equal(geocode('Erottajankatu'), null)
  assert.equal(geocode(null), null)
})
