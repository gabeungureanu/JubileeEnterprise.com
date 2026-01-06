/**
 * RAG Retrieval Module
 * Retrieves relevant knowledge from Qdrant for runtime queries
 * Inspire Family Framework v8.0
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');
const config = require('./config');

// Initialize clients
const qdrant = new QdrantClient({
  host: config.qdrant.host,
  port: config.qdrant.port
});

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Retrieval configuration
 */
const RETRIEVAL_CONFIG = {
  defaultLimit: 5,
  maxLimit: 15,
  scoreThreshold: 0.5,
  diversityFactor: 0.3 // For MMR (Maximal Marginal Relevance)
};

/**
 * Main retrieval class for Inspire knowledge
 */
class InspireRetriever {
  constructor(options = {}) {
    this.collectionName = options.collectionName || config.qdrant.collectionName;
    this.limit = options.limit || RETRIEVAL_CONFIG.defaultLimit;
    this.scoreThreshold = options.scoreThreshold || RETRIEVAL_CONFIG.scoreThreshold;
  }

  /**
   * Generates embedding for a query
   */
  async embedQuery(query) {
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: query,
      encoding_format: 'float'
    });
    return response.data[0].embedding;
  }

  /**
   * Retrieves relevant chunks based on query
   * @param {string} query - Search query
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Retrieved chunks with scores
   */
  async retrieve(query, filters = {}) {
    // Generate query embedding
    const queryVector = await this.embedQuery(query);

    // Build filter conditions
    const filterConditions = this.buildFilters(filters);

    // Perform search
    const results = await qdrant.search(this.collectionName, {
      vector: queryVector,
      limit: this.limit,
      filter: filterConditions,
      with_payload: true,
      score_threshold: this.scoreThreshold
    });

    // Format results
    return results.map(result => ({
      id: result.id,
      score: result.score,
      text: result.payload.text,
      metadata: {
        step_number: result.payload.step_number,
        persona_scope: result.payload.persona_scope,
        content_type: result.payload.content_type,
        source_file: result.payload.source_file,
        section_title: result.payload.section_title,
        chunk_id: result.payload.chunk_id
      }
    }));
  }

  /**
   * Retrieves knowledge for a specific persona and step
   * @param {string} query - Search query
   * @param {string} persona - Persona identifier (e.g., 'jubilee', 'all')
   * @param {number} maxStep - Maximum step to include (for developmental constraints)
   */
  async retrieveForPersona(query, persona, maxStep = 32) {
    const filters = {
      persona: persona,
      maxStep: maxStep
    };

    return this.retrieve(query, filters);
  }

  /**
   * Retrieves knowledge for a specific step
   * @param {string} query - Search query
   * @param {number} stepNumber - Specific step number
   */
  async retrieveForStep(query, stepNumber) {
    const filters = {
      step: stepNumber
    };

    return this.retrieve(query, filters);
  }

  /**
   * Retrieves by content type
   * @param {string} query - Search query
   * @param {string} contentType - Content type filter
   */
  async retrieveByType(query, contentType) {
    const filters = {
      contentType: contentType
    };

    return this.retrieve(query, filters);
  }

  /**
   * Retrieves multiple content types for comprehensive context
   * @param {string} query - Search query
   * @param {Object} context - Context object with persona, step, etc.
   */
  async retrieveComprehensive(query, context = {}) {
    const { persona = 'all', currentStep = 32, contentTypes = [] } = context;

    const results = [];

    // If specific content types requested
    if (contentTypes.length > 0) {
      for (const type of contentTypes) {
        const typeResults = await this.retrieve(query, {
          persona: persona,
          maxStep: currentStep,
          contentType: type
        });
        results.push(...typeResults);
      }
    } else {
      // General retrieval
      const generalResults = await this.retrieve(query, {
        persona: persona,
        maxStep: currentStep
      });
      results.push(...generalResults);
    }

    // Deduplicate by chunk_id
    const seen = new Set();
    const deduplicated = results.filter(r => {
      if (seen.has(r.metadata.chunk_id)) return false;
      seen.add(r.metadata.chunk_id);
      return true;
    });

    // Sort by score
    deduplicated.sort((a, b) => b.score - a.score);

    // Return top results
    return deduplicated.slice(0, this.limit);
  }

  /**
   * Builds Qdrant filter conditions from options
   */
  buildFilters(options) {
    const must = [];
    const should = [];

    // Step number filter (max step for developmental constraints)
    if (options.maxStep !== undefined) {
      must.push({
        key: 'step_number',
        range: {
          lte: options.maxStep
        }
      });
    }

    // Specific step filter
    if (options.step !== undefined) {
      must.push({
        key: 'step_number',
        match: { value: options.step }
      });
    }

    // Persona filter
    if (options.persona && options.persona !== 'all') {
      should.push({
        key: 'persona_scope',
        match: { any: ['all'] }
      });
      should.push({
        key: 'persona_scope',
        match: { any: [options.persona] }
      });
    }

    // Content type filter
    if (options.contentType) {
      must.push({
        key: 'content_type',
        match: { value: options.contentType }
      });
    }

    // Build final filter
    const filter = {};

    if (must.length > 0) {
      filter.must = must;
    }

    if (should.length > 0) {
      filter.should = should;
      filter.min_should = { conditions: should, min_count: 1 };
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  /**
   * Formats retrieved results for prompt injection
   */
  formatForPrompt(results) {
    if (results.length === 0) {
      return '';
    }

    const sections = [];

    sections.push('[RETRIEVED KNOWLEDGE]');

    for (const result of results) {
      sections.push('---');
      sections.push(`Source: ${result.metadata.source_file} (Step ${result.metadata.step_number})`);
      sections.push(`Type: ${result.metadata.content_type}`);
      sections.push(`Relevance: ${(result.score * 100).toFixed(1)}%`);
      sections.push('');
      sections.push(result.text);
    }

    sections.push('---');
    sections.push('[END RETRIEVED KNOWLEDGE]');

    return sections.join('\n');
  }
}

/**
 * Quick retrieval function for simple queries
 */
async function quickRetrieve(query, options = {}) {
  const retriever = new InspireRetriever(options);
  return retriever.retrieve(query, options.filters || {});
}

/**
 * Get collection statistics
 */
async function getCollectionStats() {
  const info = await qdrant.getCollection(config.qdrant.collectionName);

  // Get content type distribution
  const scroll = await qdrant.scroll(config.qdrant.collectionName, {
    limit: 10000,
    with_payload: ['content_type', 'step_number', 'persona_scope'],
    with_vector: false
  });

  const stats = {
    totalPoints: info.points_count,
    byContentType: {},
    byStep: {},
    byPersona: {}
  };

  for (const point of scroll.points) {
    // Count by content type
    const type = point.payload.content_type;
    stats.byContentType[type] = (stats.byContentType[type] || 0) + 1;

    // Count by step
    const step = point.payload.step_number;
    stats.byStep[step] = (stats.byStep[step] || 0) + 1;

    // Count by persona
    for (const persona of point.payload.persona_scope || []) {
      stats.byPersona[persona] = (stats.byPersona[persona] || 0) + 1;
    }
  }

  return stats;
}

module.exports = {
  InspireRetriever,
  quickRetrieve,
  getCollectionStats,
  RETRIEVAL_CONFIG
};
