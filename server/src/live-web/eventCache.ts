import type { NewsTopic, WebNewsEvent } from '@webworld/shared';

interface CacheEntry {
  events: WebNewsEvent[];
  expiresAt: number;
}

/**
 * Caches normalized Context.dev news per topic and rotates selection so consecutive
 * clicks on SYNC REALITY surface varied headlines.
 */
export class LiveEventCache {
  private readonly store = new Map<NewsTopic, CacheEntry>();
  private readonly allById = new Map<string, WebNewsEvent>();
  private readonly recentlyUsedIds: string[] = [];
  private readonly ttlMs: number;

  constructor(ttlMs = 3 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  getTopicEvents(topic: NewsTopic, now = Date.now()): WebNewsEvent[] | null {
    const entry = this.store.get(topic);
    if (!entry) return null;
    if (now > entry.expiresAt) {
      this.store.delete(topic);
      return null;
    }
    return entry.events;
  }

  setTopicEvents(topic: NewsTopic, events: WebNewsEvent[], now = Date.now()): void {
    this.store.set(topic, {
      events,
      expiresAt: now + this.ttlMs,
    });
    for (const ev of events) {
      this.allById.set(ev.id, ev);
    }
  }

  getById(id: string): WebNewsEvent | undefined {
    return this.allById.get(id);
  }

  pickNextEvent(events: WebNewsEvent[], preferredId?: string): WebNewsEvent | null {
    if (preferredId) {
      const explicit = events.find((e) => e.id === preferredId) ?? this.allById.get(preferredId);
      if (explicit) {
        this.markUsed(explicit.id);
        return explicit;
      }
    }
    if (events.length === 0) return null;

    const fresh = events.find((e) => !this.recentlyUsedIds.includes(e.id));
    const chosen = fresh ?? events[0];
    this.markUsed(chosen.id);
    return chosen;
  }

  private markUsed(id: string): void {
    const idx = this.recentlyUsedIds.indexOf(id);
    if (idx !== -1) this.recentlyUsedIds.splice(idx, 1);
    this.recentlyUsedIds.push(id);
    if (this.recentlyUsedIds.length > 10) {
      this.recentlyUsedIds.shift();
    }
  }
}
