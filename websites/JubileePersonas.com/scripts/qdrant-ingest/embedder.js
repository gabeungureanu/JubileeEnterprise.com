/**
 * Embedding Generation Module
 * Generates vector embeddings using OpenAI's embedding API
 * Inspire Family Framework v8.0
 */

const OpenAI = require('openai');
const config = require('./config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

// Rate limiting configuration
const RATE_LIMIT = {
  requestsPerMinute: 3000,
  tokensPerMinute: 1000000,
  batchSize: 100,
  delayBetweenBatches: 100 // ms
};

/**
 * Generates embedding for a single text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: text,
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding error:', error.message);
    throw error;
  }
}

/**
 * Generates embeddings for multiple texts in batches
 * @param {string[]} texts - Array of texts to embed
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function generateEmbeddingsBatch(texts, progressCallback = null) {
  const embeddings = [];
  const batches = [];

  // Split into batches
  for (let i = 0; i < texts.length; i += RATE_LIMIT.batchSize) {
    batches.push(texts.slice(i, i + RATE_LIMIT.batchSize));
  }

  console.log(`\n  Processing ${texts.length} texts in ${batches.length} batches...`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    try {
      const response = await openai.embeddings.create({
        model: config.openai.embeddingModel,
        input: batch,
        encoding_format: 'float'
      });

      // Extract embeddings in order
      const batchEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);

      embeddings.push(...batchEmbeddings);

      // Progress update
      const progress = Math.round(((batchIndex + 1) / batches.length) * 100);
      if (progressCallback) {
        progressCallback(progress, batchIndex + 1, batches.length);
      } else {
        process.stdout.write(`\r  Batch ${batchIndex + 1}/${batches.length} (${progress}%)`);
      }

      // Rate limiting delay
      if (batchIndex < batches.length - 1) {
        await sleep(RATE_LIMIT.delayBetweenBatches);
      }

    } catch (error) {
      if (error.status === 429) {
        // Rate limited - wait and retry
        console.log('\n  Rate limited, waiting 60 seconds...');
        await sleep(60000);
        batchIndex--; // Retry this batch
      } else {
        throw error;
      }
    }
  }

  console.log(''); // New line after progress
  return embeddings;
}

/**
 * Prepares text for embedding by adding context prefix
 * @param {Object} chunk - Chunk object with content and metadata
 * @returns {string} Prepared text for embedding
 */
function prepareTextForEmbedding(chunk) {
  const { content, metadata } = chunk;

  // Add contextual prefix for better semantic search
  const prefix = buildContextPrefix(metadata);

  return `${prefix}\n\n${content}`;
}

/**
 * Builds a context prefix from metadata
 */
function buildContextPrefix(metadata) {
  const parts = [];

  parts.push(`Inspire Family Framework - Step ${metadata.step_number}`);

  if (metadata.content_type) {
    const typeLabel = metadata.content_type.replace(/_/g, ' ').toUpperCase();
    parts.push(`Content Type: ${typeLabel}`);
  }

  if (metadata.persona_scope && !metadata.persona_scope.includes('all')) {
    parts.push(`Personas: ${metadata.persona_scope.join(', ')}`);
  }

  if (metadata.section_title && metadata.section_title !== 'HEADER') {
    parts.push(`Section: ${metadata.section_title}`);
  }

  return parts.join(' | ');
}

/**
 * Validates embedding dimensions
 */
function validateEmbedding(embedding) {
  if (!Array.isArray(embedding)) {
    throw new Error('Embedding is not an array');
  }

  if (embedding.length !== config.qdrant.vectorSize) {
    throw new Error(`Expected ${config.qdrant.vectorSize} dimensions, got ${embedding.length}`);
  }

  return true;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
  prepareTextForEmbedding,
  validateEmbedding,
  buildContextPrefix
};
