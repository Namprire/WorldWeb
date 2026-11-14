import { z } from 'zod';

export const EventProvenanceSchema = z.enum(['live_web', 'simulated_demo']);
export type EventProvenance = z.infer<typeof EventProvenanceSchema>;

export const NewsTopicSchema = z.enum([
  'nvidia',
  'artificial_intelligence',
  'gpu_markets',
  'tech_companies',
  'tech_announcements',
]);
export type NewsTopic = z.infer<typeof NewsTopicSchema>;

export const WebNewsEventSchema = z
  .object({
    id: z.string().min(1),
    headline: z.string().min(3).max(240),
    summary: z.string().min(5).max(800),
    sourceUrl: z.string().url().nullable(),
    sourceName: z.string().min(1).max(120),
    publishedAt: z.string().nullable(),
    retrievedAt: z.string().min(1),
    topic: NewsTopicSchema,
    provenance: EventProvenanceSchema,
  })
  .superRefine((val, ctx) => {
    // Never allow simulated demo news to masquerade as live web URLs, or live web without URL
    if (val.provenance === 'live_web' && !val.sourceUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceUrl'],
        message: 'Live web events must carry a valid sourceUrl for attribution.',
      });
    }
    if (val.provenance === 'simulated_demo' && val.sourceUrl !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceUrl'],
        message: 'Simulated demo events must have sourceUrl = null so fictional events never pose as real URLs.',
      });
    }
  });

export type WebNewsEvent = z.infer<typeof WebNewsEventSchema>;
