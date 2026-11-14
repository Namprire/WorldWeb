import { z } from 'zod';
import { LOCATION_IDS } from './locations';

const shortText = (max: number) => z.string().trim().min(1).max(max);
const sourceUrl = z.url({ protocol: /^https?$/ }).max(2048);
const timestamp = z.iso.datetime({ offset: true });

export const newsEventSchema = z.strictObject({
  id: shortText(160),
  mode: z.enum(['live', 'demo']),
  headline: shortText(220),
  summary: shortText(640),
  sourceName: shortText(120),
  sourceUrl: sourceUrl.nullable(),
  publishedAt: timestamp.nullable(),
  retrievedAt: timestamp,
}).refine((event) => event.mode === 'demo' || event.sourceUrl !== null, {
  path: ['sourceUrl'],
  message: 'Live news requires a source URL.',
});

const missionStepSchema = z.strictObject({
  location: z.enum(LOCATION_IDS),
  label: shortText(52),
  action: z.enum(['interact', 'collect', 'deliver']),
});

const worldScenarioShape = z.strictObject({
  eventType: z.enum(['robot_uprising', 'gpu_market_crash', 'technology_breakthrough']),
  mission: z.strictObject({
    title: shortText(64),
    description: shortText(200),
    objective: shortText(104),
    steps: z.array(missionStepSchema).min(2).max(4),
  }),
  worldChanges: z.strictObject({
    atmosphere: z.enum(['emergency', 'market', 'breakthrough']),
    spawnRobots: z.number().int().min(0).max(12),
    spawnDrones: z.number().int().min(0).max(10),
    trafficMode: z.enum(['normal', 'chaos']),
    billboardText: shortText(42),
    npcMood: z.enum(['calm', 'panic', 'excited']),
  }),
  dialogue: z.array(z.strictObject({ speaker: shortText(32), text: shortText(140) })).min(1).max(3),
});

// Gemini consumes the structural schema. Zod checks gameplay rules after parsing.
export const worldScenarioJsonSchema = z.toJSONSchema(worldScenarioShape, { target: 'draft-7' });

export const worldScenarioSchema = worldScenarioShape.superRefine(({ eventType, mission, worldChanges }, ctx) => {
  const locations = new Set(mission.steps.map(({ location }) => location));
  if (locations.size !== mission.steps.length) {
    ctx.addIssue({ code: 'custom', path: ['mission', 'steps'], message: 'Each step needs a different location.' });
  }

  const delivery = mission.steps.findIndex(({ action }) => action === 'deliver');
  if (delivery !== -1 && (
    delivery !== mission.steps.length - 1 || !mission.steps.slice(0, delivery).some(({ action }) => action === 'collect')
  )) {
    ctx.addIssue({ code: 'custom', path: ['mission', 'steps'], message: 'Delivery must come last and follow a collection.' });
  }

  const { atmosphere, npcMood, spawnRobots, spawnDrones, trafficMode } = worldChanges;
  const validEffects = {
    robot_uprising: atmosphere === 'emergency' && spawnRobots >= 3 && npcMood === 'panic',
    gpu_market_crash: atmosphere === 'market' && trafficMode === 'chaos' && npcMood === 'panic',
    technology_breakthrough: atmosphere === 'breakthrough' && spawnDrones >= 3 && npcMood === 'excited',
  };
  if (!validEffects[eventType]) {
    ctx.addIssue({ code: 'custom', path: ['worldChanges'], message: 'World effects must match the event type.' });
  }
});

export const syncResultSchema = z.strictObject({ news: newsEventSchema, scenario: worldScenarioSchema });

export type NewsEvent = z.infer<typeof newsEventSchema>;
export type WorldScenario = z.infer<typeof worldScenarioSchema>;
export type MissionStep = z.infer<typeof missionStepSchema>;
export type SyncResult = z.infer<typeof syncResultSchema>;
