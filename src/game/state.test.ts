import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from 'zustand/vanilla';
import { getDemoEvent } from '../shared/demo';
import { gameState } from './state';

const fixture = getDemoEvent(2);
const news = { ...fixture.news, mode: 'live', sourceName: 'Test publisher', sourceUrl: 'https://example.org/tech' };

test('live success applies only a validated live scenario', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ news, scenario: fixture.scenario }));
  const store = createStore(gameState);
  store.setState({ liveAvailable: true });
  store.getState().setMode('live');
  await store.getState().sync();
  assert.equal(store.getState().news?.mode, 'live');
  assert.equal(store.getState().mission.status, 'active');
});

test('director failure preserves the previous scenario and displays the failed sync source separately', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Director unavailable.', news }, { status: 502 }));
  const store = createStore(gameState);
  store.setState({ liveAvailable: true });
  await store.getState().sync();
  const previous = store.getState().scenario;
  store.getState().setMode('live');
  await store.getState().sync();
  assert.equal(store.getState().status, 'error');
  assert.equal(store.getState().scenario, previous);
  assert.equal(store.getState().news?.mode, 'demo');
  assert.equal(store.getState().attemptedNews?.mode, 'live');
});

test('switching modes during sync discards the abandoned response', async (t) => {
  let respond!: (response: Response) => void;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => { respond = resolve; }));
  const store = createStore(gameState);
  store.setState({ liveAvailable: true });
  store.getState().setMode('live');
  const pending = store.getState().sync();
  store.getState().setMode('demo');
  await store.getState().sync();
  respond(Response.json({ news, scenario: fixture.scenario }));
  await pending;
  assert.equal(store.getState().news?.mode, 'demo');
  assert.equal(store.getState().scenario?.eventType, 'robot_uprising');
});
