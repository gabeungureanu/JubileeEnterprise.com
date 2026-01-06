import { QdrantClient } from '@qdrant/js-client-rest';

export interface SearchFilters {
  domain?: string;
  persona?: string;
  abilities?: string[];
  models?: string[];
  guardrailLevel?: string;
  languages?: string[];
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload: Record<string, unknown>;
}

interface FilterCondition {
  key: string;
  match: { value: string | boolean | number };
}

export class QdrantReader {
  private client: QdrantClient;
  private collectionName: string;

  constructor(url: string, apiKey: string | undefined, collectionName: string) {
    this.client = new QdrantClient({ url, apiKey });
    this.collectionName = collectionName;
  }

  /**
   * Semantic search with mandatory active/non-placeholder filters.
   * ALWAYS excludes placeholders and deprecated entries.
   */
  async search(
    vector: number[],
    filters: SearchFilters = {},
    limit: number = 10
  ): Promise<SearchResult[]> {
    // Build filter — ALWAYS exclude placeholders and deprecated
    const must: FilterCondition[] = [
      { key: 'status', match: { value: 'active' } },
      { key: 'is_placeholder', match: { value: false } }
    ];

    if (filters.domain) {
      must.push({ key: 'domain', match: { value: filters.domain } });
    }

    if (filters.persona) {
      must.push({ key: 'scope_sub_key', match: { value: filters.persona } });
    }

    if (filters.guardrailLevel) {
      must.push({ key: 'guardrail_level', match: { value: filters.guardrailLevel } });
    }

    const response = await this.client.search(this.collectionName, {
      vector,
      limit,
      filter: { must },
      with_payload: true
    });

    return response.map(result => ({
      id: result.id,
      score: result.score,
      payload: result.payload as Record<string, unknown>
    }));
  }

  /**
   * Search with custom filter (for advanced use cases)
   */
  async searchWithFilter(
    vector: number[],
    filter: { must?: FilterCondition[]; should?: FilterCondition[]; must_not?: FilterCondition[] },
    limit: number = 10
  ): Promise<SearchResult[]> {
    // Always add base filters
    const baseFilter = {
      must: [
        { key: 'status', match: { value: 'active' } },
        { key: 'is_placeholder', match: { value: false } },
        ...(filter.must || [])
      ],
      should: filter.should,
      must_not: filter.must_not
    };

    const response = await this.client.search(this.collectionName, {
      vector,
      limit,
      filter: baseFilter,
      with_payload: true
    });

    return response.map(result => ({
      id: result.id,
      score: result.score,
      payload: result.payload as Record<string, unknown>
    }));
  }

  /**
   * Get entries by persona (both direct and inherited from _shared)
   */
  async getByPersona(persona: string, domainKey: string = 'Inspire'): Promise<SearchResult[]> {
    const response = await this.client.scroll(this.collectionName, {
      limit: 1000,
      filter: {
        must: [
          { key: 'status', match: { value: 'active' } },
          { key: 'is_placeholder', match: { value: false } },
          { key: 'scope_domain_key', match: { value: domainKey } }
        ],
        should: [
          { key: 'scope_sub_key', match: { value: persona } },
          { key: 'scope_sub_key', match: { value: '_shared' } }
        ]
      },
      with_payload: true,
      with_vector: false
    });

    return response.points.map(point => ({
      id: point.id,
      score: 1.0,
      payload: point.payload as Record<string, unknown>
    }));
  }

  /**
   * Get all entries in a domain
   */
  async getByDomain(domain: string): Promise<SearchResult[]> {
    const response = await this.client.scroll(this.collectionName, {
      limit: 1000,
      filter: {
        must: [
          { key: 'status', match: { value: 'active' } },
          { key: 'is_placeholder', match: { value: false } },
          { key: 'domain', match: { value: domain } }
        ]
      },
      with_payload: true,
      with_vector: false
    });

    return response.points.map(point => ({
      id: point.id,
      score: 1.0,
      payload: point.payload as Record<string, unknown>
    }));
  }

  /**
   * Get a specific point by ID
   */
  async getById(id: string): Promise<SearchResult | null> {
    try {
      const response = await this.client.retrieve(this.collectionName, {
        ids: [id],
        with_payload: true,
        with_vector: false
      });

      if (response.length > 0) {
        return {
          id: response[0].id,
          score: 1.0,
          payload: response[0].payload as Record<string, unknown>
        };
      }
    } catch {
      // Point not found
    }

    return null;
  }

  /**
   * Recommend similar entries based on an existing entry
   */
  async recommend(
    positiveIds: string[],
    negativeIds: string[] = [],
    limit: number = 10
  ): Promise<SearchResult[]> {
    const response = await this.client.recommend(this.collectionName, {
      positive: positiveIds,
      negative: negativeIds,
      limit,
      filter: {
        must: [
          { key: 'status', match: { value: 'active' } },
          { key: 'is_placeholder', match: { value: false } }
        ]
      },
      with_payload: true
    });

    return response.map(result => ({
      id: result.id,
      score: result.score,
      payload: result.payload as Record<string, unknown>
    }));
  }

  /**
   * Count entries matching a filter
   */
  async count(filter?: { must?: FilterCondition[] }): Promise<number> {
    const baseFilter = {
      must: [
        { key: 'status', match: { value: 'active' } },
        { key: 'is_placeholder', match: { value: false } },
        ...(filter?.must || [])
      ]
    };

    const response = await this.client.count(this.collectionName, {
      filter: baseFilter,
      exact: true
    });

    return response.count;
  }
}
