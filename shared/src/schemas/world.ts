import { z } from 'zod';
import { LANDMARK_IDS, WORLD_LIMITS } from '../config.js';

export const EventTypeSchema = z.enum([
  'robot_uprising',
  'gpu_market_crash',
  'tech_breakthrough',
  'ceo_controversy',
  'product_launch',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const SkyColorPresetSchema = z.enum([
  'cyber_night',
  'red',
  'amber_crash',
  'electric_blue',
  'neon_purple',
  'emerald_surge',
]);
export type SkyColorPreset = z.infer<typeof SkyColorPresetSchema>;

export const TrafficModeSchema = z.enum(['normal', 'chaos', 'gridlock', 'hyperloop']);
export type TrafficMode = z.infer<typeof TrafficModeSchema>;

export const NpcMoodSchema = z.enum(['calm', 'panic', 'celebrate', 'protest', 'awe']);
export type NpcMood = z.infer<typeof NpcMoodSchema>;

export const WeatherEffectSchema = z.enum(['clear', 'digital_rain', 'ember_sparks', 'data_snow']);
export type WeatherEffect = z.infer<typeof WeatherEffectSchema>;

export const LandmarkIdSchema = z.enum(LANDMARK_IDS);

export const MissionSchema = z.object({
  title: z.string().min(2).max(80),
  storyline: z.string().min(5).max(320),
  description: z.string().min(5).max(260),
  objective: z.string().min(4).max(140),
  target_landmark: LandmarkIdSchema,
  action_label: z.string().min(2).max(60),
  reward_tflops: z.number().int().min(10).max(10000),
});
export type MissionSpec = z.infer<typeof MissionSchema>;

export const WorldChangesSchema = z.object({
  sky_color: SkyColorPresetSchema,
  spawn_robots: z.number().int().min(0).max(WORLD_LIMITS.MAX_ROBOTS),
  spawn_drones: z.number().int().min(0).max(WORLD_LIMITS.MAX_DRONES),
  traffic_mode: TrafficModeSchema,
  billboard_text: z.string().min(2).max(64),
  ticker_text: z.string().min(2).max(96),
  npc_mood: NpcMoodSchema,
  emergency_lights: z.boolean(),
  weather_effect: WeatherEffectSchema,
});
export type WorldChanges = z.infer<typeof WorldChangesSchema>;

export const DialogueLineSchema = z.object({
  speaker: z.string().min(1).max(48),
  text: z.string().min(2).max(220),
});
export type DialogueLine = z.infer<typeof DialogueLineSchema>;

export const OptionalAssetPromptsSchema = z.object({
  billboard_image_prompt: z.string().max(260).optional(),
  cutscene_video_prompt: z.string().max(260).optional(),
});

export const WorldDirectorResponseSchema = z.object({
  event_type: EventTypeSchema,
  mission: MissionSchema,
  world_changes: WorldChangesSchema,
  dialogue: z.array(DialogueLineSchema).min(1).max(5),
  asset_prompts: OptionalAssetPromptsSchema.optional(),
});
export type WorldDirectorResponse = z.infer<typeof WorldDirectorResponseSchema>;

/**
 * Clamp numeric parameters and normalize display strings into safe engine bounds.
 */
export function sanitizeWorldDirectorResponse(
  raw: WorldDirectorResponse
): WorldDirectorResponse {
  return {
    ...raw,
    mission: {
      ...raw.mission,
      title: raw.mission.title.trim().slice(0, 80),
      storyline: raw.mission.storyline.trim().slice(0, 320),
      description: raw.mission.description.trim().slice(0, 260),
      objective: raw.mission.objective.trim().slice(0, 140),
      action_label: raw.mission.action_label.trim().slice(0, 60),
      reward_tflops: Math.max(10, Math.min(10000, Math.round(raw.mission.reward_tflops))),
    },
    world_changes: {
      ...raw.world_changes,
      spawn_robots: Math.max(
        0,
        Math.min(WORLD_LIMITS.MAX_ROBOTS, Math.round(raw.world_changes.spawn_robots))
      ),
      spawn_drones: Math.max(
        0,
        Math.min(WORLD_LIMITS.MAX_DRONES, Math.round(raw.world_changes.spawn_drones))
      ),
      billboard_text: raw.world_changes.billboard_text.trim().toUpperCase().slice(0, 64),
      ticker_text: raw.world_changes.ticker_text.trim().toUpperCase().slice(0, 96),
    },
  };
}
