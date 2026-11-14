import ContextDev from 'context.dev';
import type { NewsTopic, WebNewsEvent } from '@webworld/shared';
import { normalizeContextSearchItems, type RawWebSearchItem } from './normalizer.js';
import { LiveEventCache } from './eventCache.js';

const TOPIC_NEWS_SEARCH: Record<NewsTopic, ContextDev.NewsSearchParams['searchBy']> = {
  nvidia: {
    type: 'entity',
    entity: { type: 'ticker', ticker: 'NVDA', exchange: 'NASDAQ' },
  },
  artificial_intelligence: {
    type: 'natural_language',
    query: 'major artificial intelligence breakthrough frontier model robotics',
  },
  gpu_markets: {
    type: 'natural_language',
    query: 'GPU semiconductor data center chip demand market stock',
  },
  tech_companies: {
    type: 'natural_language',
    query: 'OpenAI Google DeepMind Meta Microsoft AI announcement CEO',
  },
  tech_announcements: {
    type: 'natural_language',
    query: 'new AI hardware chip product launch tech keynote',
  },
};

const TOPIC_WEB_FALLBACK_QUERIES: Record<NewsTopic, string> = {
  nvidia: 'NVIDIA Jensen Huang GPU AI announcement news',
  artificial_intelligence: 'major artificial intelligence breakthrough frontier model news',
  gpu_markets: 'GPU semiconductor stock market data center news',
  tech_companies: 'OpenAI Google DeepMind Meta Microsoft AI news',
  tech_announcements: 'major technology company AI product launch news',
};

export class ContextWebService {
  private readonly apiKey: string | null;
  private readonly cache: LiveEventCache;

  constructor(apiKey: string | null, cache = new LiveEventCache()) {
    this.apiKey = apiKey;
    this.cache = cache;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async retrieveTopicNews(topic: NewsTopic, forceRefresh = false): Promise<WebNewsEvent[]> {
    if (!this.apiKey) {
      throw new Error('CONTEXT_DEV_API_KEY is not configured on the server.');
    }

    if (!forceRefresh) {
      const cached = this.cache.getTopicEvents(topic);
      if (cached && cached.length > 0) {
        return cached;
      }
    }

    const client = new ContextDev({
      apiKey: this.apiKey,
      timeout: 15_000,
      maxRetries: 1,
    });

    const retrievedAt = new Date().toISOString();
    let events: WebNewsEvent[] = [];

    // 1. Primary: Context.dev Live News Search (`client.news.search`)
    try {
      const newsResp = await client.news.search({
        searchBy: TOPIC_NEWS_SEARCH[topic],
        limit: 8,
        filterBy: { articleLanguage: ['en'] },
      });

      const mappedNews: RawWebSearchItem[] = (newsResp.data ?? []).map((article) => ({
        url: article.url,
        title: article.title,
        description: article.description ?? undefined,
        published_at: article.published_at ?? undefined,
        source: article.source?.name || article.source?.domain,
      }));

      events = normalizeContextSearchItems(mappedNews, topic, retrievedAt);
    } catch (newsErr) {
      console.warn(
        `[live-web] Context.dev news.search failed for topic="${topic}", trying web.search:`,
        newsErr instanceof Error ? newsErr.message : newsErr
      );
    }

    // 2. Secondary live path: Context.dev Web Search (`client.web.search` with freshness)
    if (events.length === 0) {
      const webResp = await client.web.search({
        query: TOPIC_WEB_FALLBACK_QUERIES[topic],
        freshness: 'last_week',
        descriptionMaxCharacters: 420,
      });

      const rawWebItems: RawWebSearchItem[] = (webResp.results ?? []).map((r) => {
        const item = r as unknown as Record<string, unknown>;
        return {
          url: typeof item.url === 'string' ? item.url : undefined,
          title: typeof item.title === 'string' ? item.title : undefined,
          description:
            typeof item.description === 'string'
              ? item.description
              : typeof item.snippet === 'string'
                ? item.snippet
                : undefined,
          publishedAt:
            typeof item.publishedAt === 'string'
              ? item.publishedAt
              : typeof item.date === 'string'
                ? item.date
                : undefined,
        };
      });

      events = normalizeContextSearchItems(rawWebItems, topic, retrievedAt);
    }

    if (events.length === 0) {
      throw new Error(
        `Context.dev returned no usable live articles for topic "${topic}". Try another topic or refresh.`
      );
    }

    this.cache.setTopicEvents(topic, events);
    return events;
  }

  async selectLiveEvent(topic: NewsTopic, preferredId?: string): Promise<WebNewsEvent> {
    if (preferredId) {
      const existing = this.cache.getById(preferredId);
      if (existing) return existing;
    }
    const events = await this.retrieveTopicNews(topic);
    const chosen = this.cache.pickNextEvent(events, preferredId);
    if (!chosen) {
      throw new Error('No live internet event could be selected from Context.dev.');
    }
    return chosen;
  }
}
