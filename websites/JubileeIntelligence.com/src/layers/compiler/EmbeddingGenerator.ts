import OpenAI from 'openai';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokens: number;
}

export class EmbeddingGenerator {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Generate embedding for a single text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text
    });
    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for a batch of texts
   * More efficient than individual calls for multiple texts
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts
    });
    return response.data.map(d => d.embedding);
  }

  /**
   * Generate embeddings with full result info including token usage
   */
  async generateWithMetadata(texts: string[]): Promise<{
    embeddings: EmbeddingResult[];
    totalTokens: number;
  }> {
    if (texts.length === 0) {
      return { embeddings: [], totalTokens: 0 };
    }

    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts
    });

    const embeddings: EmbeddingResult[] = response.data.map((d, i) => ({
      text: texts[i],
      embedding: d.embedding,
      tokens: 0 // OpenAI doesn't provide per-text token counts
    }));

    return {
      embeddings,
      totalTokens: response.usage?.total_tokens || 0
    };
  }

  /**
   * Get the expected vector dimension for the current model
   */
  getVectorDimension(): number {
    switch (this.model) {
      case 'text-embedding-3-small':
        return 1536;
      case 'text-embedding-3-large':
        return 3072;
      case 'text-embedding-ada-002':
        return 1536;
      default:
        return 1536;
    }
  }

  /**
   * Validate that an embedding matches expected dimensions
   */
  validateEmbedding(embedding: number[]): boolean {
    return embedding.length === this.getVectorDimension();
  }
}
