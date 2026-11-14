import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cutsceneRequestSchema, cutsceneSchema, scriptSchema } from './cutscene-schema'

test('cutscene scripts only use known camera moves', () => {
  assert.equal(scriptSchema.safeParse({ title: 'x1', shots: [{ camera: 'establish', focus: null, line: 'One.' }, { camera: 'teleport', focus: null, line: 'Two.' }] }).success, false)
  assert.equal(scriptSchema.safeParse({ title: 'Night', shots: [{ camera: 'aurora', focus: null, line: 'One.' }, { camera: 'rise', focus: null, line: 'Two.' }] }).success, true)
})

test('cutscene requests are bounded', () => {
  assert.equal(cutsceneRequestSchema.safeParse({ kind: 'intro' }).success, true)
  assert.equal(cutsceneRequestSchema.safeParse({ kind: 'anything' }).success, false)
  assert.equal(cutsceneRequestSchema.safeParse({ kind: 'mission', companies: Array(7).fill('a') }).success, false)
})

test('saved cutscenes contain no em or en dashes in narration', async () => {
  const { readdirSync, readFileSync, existsSync } = await import('node:fs')
  if (!existsSync('data/cutscenes')) return
  for (const file of readdirSync('data/cutscenes').filter((f) => f.endsWith('.json'))) {
    const scene = cutsceneSchema.parse(JSON.parse(readFileSync(`data/cutscenes/${file}`, 'utf8')))
    for (const shot of scene.shots) assert.doesNotMatch(shot.line, /[\u2013\u2014]/, file)
  }
})
