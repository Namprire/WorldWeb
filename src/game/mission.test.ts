import assert from 'node:assert/strict';
import test from 'node:test';
import { getDemoEvent } from '../shared/demo';
import { LOCATIONS, SPAWN } from '../shared/locations';
import { newsEventSchema, worldScenarioSchema } from '../shared/schema';
import { advanceMission, startMission } from './mission';

test('the three demo events cycle through distinct playable world changes', () => {
  const events = [0, 1, 2].map((index) => getDemoEvent(index));
  assert.equal(new Set(events.map(({ scenario }) => scenario.worldChanges.atmosphere)).size, 3);
  assert.equal(getDemoEvent(3).news.id, events[0].news.id);

  for (const { news, scenario } of events) {
    assert.equal(news.mode, 'demo');
    let mission = startMission(scenario.mission.steps);
    for (const step of mission.steps) {
      const { x, z } = LOCATIONS[step.location];
      mission = advanceMission(mission, x, z);
    }
    assert.equal(mission.status, 'complete');
    assert.equal(mission.stepIndex, scenario.mission.steps.length);
  }
});

test('mission steps need proximity and track cargo until delivery', () => {
  const { scenario } = getDemoEvent(1);
  const mission = startMission(scenario.mission.steps);
  assert.equal(advanceMission(mission, SPAWN.x, SPAWN.z), mission);

  const at = (state: typeof mission, location: keyof typeof LOCATIONS) => {
    const { x, z } = LOCATIONS[location];
    return advanceMission(state, x, z);
  };
  const first = at(mission, 'depot');
  assert.equal(first.collected, 1);
  assert.equal(at(first, 'exchange'), first);
  const second = at(first, 'plaza');
  assert.equal(second.collected, 2);
  const complete = at(second, 'exchange');
  assert.equal(complete.collected, 0);
  assert.equal(complete.status, 'complete');
});

test('director validation rejects out-of-bounds spawns, arbitrary commands and impossible missions', () => {
  const { scenario } = getDemoEvent(0);
  for (const worldChanges of [
    { ...scenario.worldChanges, spawnRobots: 100 },
    { ...scenario.worldChanges, atmosphere: 'breakthrough' },
    { ...scenario.worldChanges, execute: 'open()' },
  ]) assert.equal(worldScenarioSchema.safeParse({ ...scenario, worldChanges }).success, false);

  const [first, second] = scenario.mission.steps;
  for (const steps of [[first, first], [first, { ...second, action: 'deliver' }]]) {
    assert.equal(worldScenarioSchema.safeParse({ ...scenario, mission: { ...scenario.mission, steps } }).success, false);
  }
});

test('live headlines require HTTP(S) attribution', () => {
  const { news } = getDemoEvent(0);
  for (const sourceUrl of [null, 'javascript:alert(1)']) {
    assert.equal(newsEventSchema.safeParse({ ...news, mode: 'live', sourceUrl }).success, false);
  }
  assert.equal(newsEventSchema.safeParse({ ...news, mode: 'live', sourceUrl: 'https://example.org/technology' }).success, true);
});
