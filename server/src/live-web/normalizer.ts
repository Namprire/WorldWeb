import crypto from 'node:crypto';
import {
  WebNewsEventSchema,
  type NewsTopic,
  type WebNewsEvent,
} from '@webworld/shared';

export interface RawWebSearchItem {
  url?: string;
  title?: string;
  headline?: string;
  description?: string;
  snippet?: string;
  summary?: string;
  markdown?: string;
  publishedAt?: string;
  published_at?: string;
  date?: string;
  source?: string;
}

function extractHostnameLabel(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return 'Web Source';
  }
}

function cleanText(input: string | undefined, fallback: string, maxLen: number): string {
  if (!input) return fallback;
  const collapsed = input
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_>`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (collapsed.length < 4) return fallback;
  return collapsed.length > maxLen ? `${collapsed.slice(0, maxLen - 1).trim()}…` : collapsed;
}

function normalizeTimestamp(raw?: string): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function normalizeContextSearchItems(
  rawItems: RawWebSearchItem[],
  topic: NewsTopic,
  retrievedAt = new Date().toISOString()
): WebNewsEvent[] {
  const normalized: WebNewsEvent[] = [];
  const seenUrls = new Set<string>();

  for (const item of rawItems) {
    const url = item.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const rawHeadline = item.title || item.headline;
    if (!rawHeadline || rawHeadline.trim().length < 5) continue;

    const headline = cleanText(rawHeadline, 'Tech Update', 220);
    const summarySource =
      item.description || item.snippet || item.summary || item.markdown || headline;
    const summary = cleanText(
      summarySource,
      `Recent web report from ${extractHostnameLabel(url)} covering ${headline}.`,
      650
    );

    const idHash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
    const publishedAt = normalizeTimestamp(
      item.publishedAt || item.published_at || item.date
    );

    const candidate: WebNewsEvent = {
      id: `live-${idHash}`,
      headline,
      summary,
      sourceUrl: url,
      sourceName: item.source?.trim() || extractHostnameLabel(url),
      publishedAt,
      retrievedAt,
      topic,
      provenance: 'live_web',
    };

    const parsed = WebNewsEventSchema.safeParse(candidate);
    if (parsed.success) {
      normalized.push(parsed.data);
    }
  }

  return normalized;
}
