import assert from 'node:assert/strict'
import test from 'node:test'
import { parseScenario } from './director'

const scenario = {
  eventType: 'technology_breakthrough',
  mission: {
    title: 'Ground Control',
    description: 'A test drone needs a firmware card.',
    objective: 'Deliver the card to Relay Tower.',
    steps: [
      { location: 'depot', label: 'Pick up the firmware card', action: 'collect' },
      { location: 'relay', label: 'Deliver the firmware card', action: 'deliver' },
    ],
  },
  worldChanges: {
    atmosphere: 'breakthrough',
    spawnRobots: 0,
    spawnDrones: 4,
    trafficMode: 'normal',
    billboardText: 'DRONE TRIAL TONIGHT',
    npcMood: 'excited',
  },
  dialogue: [{ speaker: 'Dispatcher', text: 'Who put the firmware in airplane mode?' }],
}

test('accepts structured JSON for a playable mission', () => {
  assert.deepEqual(parseScenario(JSON.stringify(scenario)), scenario)
})

test('rejects malformed JSON and unknown world commands', () => {
  assert.throws(() => parseScenario('raw text'), /did not return a playable mission/)
  assert.throws(() => parseScenario(JSON.stringify({ ...scenario, script: 'run me' })), /did not return a playable mission/)
})

test('rejects a mission with an unreachable delivery sequence', () => {
  const invalid = { ...scenario, mission: { ...scenario.mission, steps: [...scenario.mission.steps].reverse() } }
  assert.throws(() => parseScenario(JSON.stringify(invalid)), /did not return a playable mission/)
})
