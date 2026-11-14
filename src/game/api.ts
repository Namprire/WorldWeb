import { z } from 'zod';
import { newsEventSchema, syncResultSchema } from '../shared/schema';

const statusSchema = z.object({ liveAvailable: z.boolean() });
const errorSchema = z.object({ error: z.string().min(1).max(500), news: newsEventSchema.optional() });

export async function getLiveAvailability() {
  try {
    const response = await fetch('/api/status', { signal: AbortSignal.timeout(3000) });
    return response.ok && statusSchema.parse(await response.json()).liveAvailable;
  } catch {
    return false;
  }
}

export async function syncLive(signal: AbortSignal) {
  const response = await fetch('/api/sync', {
    method: 'POST',
    signal: AbortSignal.any([signal, AbortSignal.timeout(28000)]),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const result = errorSchema.safeParse(body);
    if (!result.success) return { error: 'The live server could not sync. Try again or select Demo mode.' };
    const { error, news } = result.data;
    return { error, news: news?.mode === 'live' ? news : undefined };
  }

  const result = syncResultSchema.safeParse(body);
  if (!result.success || result.data.news.mode !== 'live') {
    return { error: 'The live server returned an invalid scenario. Try syncing again.' };
  }

  return { result: result.data };
}
