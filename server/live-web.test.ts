import assert from 'node:assert/strict'
import test from 'node:test'
import { selectNews } from './live-web'

const now = new Date('2026-11-14T12:00:00Z')
const article = {
  id: 'fixture-01',
  title: '  New\n chip announced  ',
  description: 'Publisher excerpt.',
  published_at: '2026-11-14T12:30:00+02:00',
  url: 'https://example.org/chip-announcement',
  source: { name: 'Fixture News' },
}

test('selects a recent sourced article and preserves publication and retrieval times', () => {
  assert.deepEqual(selectNews({ data: [
    { ...article, url: 'javascript:alert(1)' },
    { ...article, published_at: '2025-01-01T00:00:00Z' },
    article,
  ] }, now), {
    id: 'live-fixture-01',
    mode: 'live',
    headline: 'New chip announced',
    summary: 'Publisher excerpt.',
    publishedAt: '2026-11-14T10:30:00.000Z',
    retrievedAt: '2026-11-14T12:00:00.000Z',
    sourceName: 'Fixture News',
    sourceUrl: 'https://example.org/chip-announcement',
  })
})

test('leaves publication time empty when a source does not report it', () => {
  assert.equal(selectNews({ data: [{ ...article, published_at: null }] }, now).publishedAt, null)
})

test('rejects empty provider results without generating demo news', () => {
  assert.throws(() => selectNews({ data: [] }, now), /no recent usable technology headlines/)
})
