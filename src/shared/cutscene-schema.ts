import { z } from 'zod'

/** Camera moves the scene can perform. Gemini picks from these; it never controls the camera directly. */
export const CAMERA_MOVES = ['establish', 'aurora', 'flyover', 'orbit', 'close', 'rise'] as const
export type CameraMove = (typeof CAMERA_MOVES)[number]

export const cutsceneKindSchema = z.enum(['intro', 'company', 'signal', 'mission', 'briefing', 'partners'])
export type CutsceneKind = z.infer<typeof cutsceneKindSchema>

export const cutsceneRequestSchema = z.object({
  kind: cutsceneKindSchema,
  /** Company id for company scenes, news item id for signal scenes, mission id for mission scenes. */
  id: z.string().max(80).optional(),
  /** Companies the visitor found, for mission recaps. */
  companies: z.array(z.string().max(80)).max(6).optional(),
  /** Part of the day being shown, so the opening film matches the sky. */
  phase: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
})
export type CutsceneRequest = z.infer<typeof cutsceneRequestSchema>

export const shotSchema = z.object({
  camera: z.enum(CAMERA_MOVES),
  /** A company id from the supplied records, or null for a city-wide shot. */
  focus: z.string().nullable(),
  line: z.string().min(3).max(220),
})

export const scriptSchema = z.object({
  title: z.string().min(2).max(70),
  shots: z.array(shotSchema).min(2).max(6),
})

export const cutsceneSchema = scriptSchema.extend({
  shots: z.array(shotSchema.extend({
    /** Narration audio, when a voice was generated. */
    audio: z.string().nullable(),
  })),
  writer: z.string(),
  voice: z.string().nullable(),
  /** Generated establishing film shown under the opening line. */
  film: z.object({ src: z.string(), poster: z.string(), model: z.string(), faithful: z.boolean() }).nullable().optional(),
  generatedAt: z.string(),
})
export type Cutscene = z.infer<typeof cutsceneSchema>
