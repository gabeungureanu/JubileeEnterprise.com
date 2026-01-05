import { QdrantClient } from '@qdrant/js-client-rest';

export interface QdrantOperation {
  type: 'upsert' | 'update_payload' | 'soft_delete';
  id: string;
  vector?: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantMetadata {
  overlay_id: string;
  content_hash: string;
  metadata_hash: string;
}

export class QdrantWriter {
  private client: QdrantClient;
  private collectionName: string;

  constructor(url: string, apiKey: string | undefined, collectionName: string) {
    this.client = new QdrantClient({ url, apiKey });
    this.collectionName = collectionName;
  }

  /**
   * Initialize collection with proper schema and indexes
   */
  async initializeCollection(vectorSize: number): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(c => c.name === this.collectionName);

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: { size: vectorSize, distance: 'Cosine' }
      });

      // Create payload indexes for efficient filtering
      await this.createPayloadIndexes();
    }
  }

  /**
   * Create indexes on frequently filtered fields
   */
  private async createPayloadIndexes(): Promise<void> {
    const keywordFields = [
      'status',
      'domain',
      'scope_sub_key',
      'scope_domain_key',
      'guardrail_level',
      'overlay_id'
    ];

    const boolFields = ['is_placeholder'];

    for (const field of keywordFields) {
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: field,
        field_schema: 'keyword'
      });
    }

    for (const field of boolFields) {
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: field,
        field_schema: 'bool'
      });
    }
  }

  /**
   * Execute a batch of operations (upserts, payload updates, soft deletes)
   */
  async executeBatch(operations: QdrantOperation[]): Promise<void> {
    const upserts: Array<{
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }> = [];
    const payloadUpdates: Array<{
      id: string;
      payload: Record<string, unknown>;
    }> = [];
    const softDeletes: string[] = [];

    for (const op of operations) {
      switch (op.type) {
        case 'upsert':
          if (op.vector && op.payload) {
            upserts.push({
              id: op.id,
              vector: op.vector,
              payload: op.payload
            });
          }
          break;

        case 'update_payload':
          if (op.payload) {
            payloadUpdates.push({ id: op.id, payload: op.payload });
          }
          break;

        case 'soft_delete':
          softDeletes.push(op.id);
          break;
      }
    }

    // Execute upserts in batches
    if (upserts.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < upserts.length; i += batchSize) {
        const batch = upserts.slice(i, i + batchSize);
        await this.client.upsert(this.collectionName, {
          points: batch,
          wait: true
        });
      }
    }

    // Execute payload updates
    for (const update of payloadUpdates) {
      await this.client.setPayload(this.collectionName, {
        points: [update.id],
        payload: update.payload,
        wait: true
      });
    }

    // Execute soft deletes (update status, don't remove)
    if (softDeletes.length > 0) {
      await this.client.setPayload(this.collectionName, {
        points: softDeletes,
        payload: { status: 'deprecated' },
        wait: true
      });
    }
  }

  /**
   * Upsert a single point
   */
  async upsertPoint(id: string, vector: number[], payload: Record<string, unknown>): Promise<void> {
    await this.client.upsert(this.collectionName, {
      points: [{ id, vector, payload }],
      wait: true
    });
  }

  /**
   * Update payload only (no vector change)
   */
  async updatePayload(id: string, payload: Record<string, unknown>): Promise<void> {
    await this.client.setPayload(this.collectionName, {
      points: [id],
      payload,
      wait: true
    });
  }

  /**
   * Soft delete (set status to deprecated)
   */
  async softDelete(id: string): Promise<void> {
    await this.client.setPayload(this.collectionName, {
      points: [id],
      payload: { status: 'deprecated' },
      wait: true
    });
  }

  /**
   * Hard delete (permanently remove from Qdrant) - use with caution
   */
  async hardDelete(ids: string[]): Promise<void> {
    await this.client.delete(this.collectionName, {
      points: ids,
      wait: true
    });
  }

  /**
   * Get all metadata from Qdrant for change detection
   */
  async getAllMetadata(): Promise<QdrantMetadata[]> {
    const result: QdrantMetadata[] = [];
    let offset: string | number | null | undefined = undefined;

    while (true) {
      const response = await this.client.scroll(this.collectionName, {
        limit: 100,
        offset: offset as string | number | undefined,
        with_payload: true,
        with_vector: false
      });

      for (const point of response.points) {
        const payload = point.payload as Record<string, unknown>;
        if (payload.overlay_id && payload.content_hash && payload.metadata_hash) {
          result.push({
            overlay_id: payload.overlay_id as string,
            content_hash: payload.content_hash as string,
            metadata_hash: payload.metadata_hash as string
          });
        }
      }

      if (!response.next_page_offset) break;
      offset = response.next_page_offset as string | number | null;
    }

    return result;
  }

  /**
   * Get point by overlay_id
   */
  async getByOverlayId(overlayId: string): Promise<Record<string, unknown> | null> {
    const response = await this.client.scroll(this.collectionName, {
      limit: 1,
      filter: {
        must: [
          { key: 'overlay_id', match: { value: overlayId } }
        ]
      },
      with_payload: true,
      with_vector: false
    });

    if (response.points.length > 0) {
      return response.points[0].payload as Record<string, unknown>;
    }

    return null;
  }

  /**
   * Check if collection exists
   */
  async collectionExists(): Promise<boolean> {
    const collections = await this.client.getCollections();
    return collections.collections.some(c => c.name === this.collectionName);
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<{
    pointCount: number;
    vectorSize: number;
  }> {
    const info = await this.client.getCollection(this.collectionName);
    let vectorSize = 0;

    if (info.config.params.vectors) {
      const vectors = info.config.params.vectors;
      if (typeof vectors === 'object' && 'size' in vectors) {
        vectorSize = (vectors as { size: number }).size;
      }
    }

    return {
      pointCount: info.points_count || 0,
      vectorSize
    };
  }

  /**
   * Delete collection (use with extreme caution)
   */
  async deleteCollection(): Promise<void> {
    await this.client.deleteCollection(this.collectionName);
  }
}
