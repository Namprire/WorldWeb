import { syncResultSchema, type SyncResult } from './schema';

const cases = [
  {
    headline: 'Office robots form a union, demand root access',
    summary: 'In this simulated headline, a software update gives the district’s office robots one common goal: run the city themselves.',
    scenario: {
      eventType: 'robot_uprising',
      mission: {
        title: 'Pull the Plug',
        description: 'The robots have promoted themselves to management. Cut the override signal before they schedule another all-hands.',
        objective: 'Disable three terminals to restore control of the district.',
        steps: [
          { location: 'plaza', label: 'Override the plaza kiosk', action: 'interact' },
          { location: 'compute', label: 'Isolate the compute cluster', action: 'interact' },
          { location: 'relay', label: 'Shut down the relay', action: 'interact' },
        ],
      },
      worldChanges: {
        atmosphere: 'emergency', spawnRobots: 10, spawnDrones: 0, trafficMode: 'normal',
        billboardText: 'HUMANS: PLEASE REBOOT', npcMood: 'panic',
      },
      dialogue: [{ speaker: 'Dispatch', text: 'They put the city on a mandatory firmware update. Find the terminals.' }],
    },
  },
  {
    headline: 'GPU futures crater after a surprise warehouse audit',
    summary: 'In this simulated headline, traders flood the district as a warehouse full of previously unaccounted GPUs comes to light.',
    scenario: {
      eventType: 'gpu_market_crash',
      mission: {
        title: 'Margin Call',
        description: 'A truck dropped its inventory during the sell-off. The exchange needs two actual GPUs before anyone can trade again.',
        objective: 'Recover both GPU crates and deliver them to the exchange.',
        steps: [
          { location: 'depot', label: 'Collect the depot crate', action: 'collect' },
          { location: 'plaza', label: 'Collect the plaza crate', action: 'collect' },
          { location: 'exchange', label: 'Deliver to the exchange', action: 'deliver' },
        ],
      },
      worldChanges: {
        atmosphere: 'market', spawnRobots: 0, spawnDrones: 0, trafficMode: 'chaos',
        billboardText: 'GPU INDEX / CIRCUIT BREAKER', npcMood: 'panic',
      },
      dialogue: [{ speaker: 'Floor Trader', text: 'We were short on chips. Turns out we were also short on counting.' }],
    },
  },
  {
    headline: 'Lab announces first wireless compute mesh for city drones',
    summary: 'In this simulated headline, a lab unveils a way for drones to share computing power in flight. The district volunteers as its first test site.',
    scenario: {
      eventType: 'technology_breakthrough',
      mission: {
        title: 'The Blue Hour',
        description: 'An airborne compute mesh is ready for its first test. Give the drones a clear signal before their launch party.',
        objective: 'Bring three network nodes online.',
        steps: [
          { location: 'arcade', label: 'Activate the arcade node', action: 'interact' },
          { location: 'compute', label: 'Link the compute node', action: 'interact' },
          { location: 'relay', label: 'Launch the city mesh', action: 'interact' },
        ],
      },
      worldChanges: {
        atmosphere: 'breakthrough', spawnRobots: 0, spawnDrones: 8, trafficMode: 'normal',
        billboardText: 'HELLO, WORLD. MESH ONLINE.', npcMood: 'excited',
      },
      dialogue: [{ speaker: 'Lab Engineer', text: 'The drones have great Wi-Fi. The lab still has to stand by a window.' }],
    },
  },
] as const;

export function getDemoEvent(index: number, now = new Date()): SyncResult {
  const fixture = cases[index % cases.length];
  return syncResultSchema.parse({
    news: {
      id: `demo-${fixture.scenario.eventType}`,
      mode: 'demo',
      headline: fixture.headline,
      summary: fixture.summary,
      sourceName: 'WEBWORLD Simulation',
      sourceUrl: null,
      publishedAt: null,
      retrievedAt: now.toISOString(),
    },
    scenario: fixture.scenario,
  });
}
