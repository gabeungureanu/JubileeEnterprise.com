/**
 * Qdrant Ingestion Module Entry Point
 * Inspire Family Framework v8.0
 *
 * This module provides Qdrant-based vector storage and retrieval
 * for the Inspire Family persona framework.
 *
 * Usage:
 *   const { InspireRetriever, quickRetrieve } = require('./scripts/qdrant-ingest');
 *
 *   // Create retriever instance
 *   const retriever = new InspireRetriever({ limit: 5 });
 *
 *   // Retrieve relevant knowledge
 *   const results = await retriever.retrieve('covenant declaration');
 *
 *   // Retrieve for specific persona
 *   const jubileeResults = await retriever.retrieveForPersona(
 *     'prophetic ministry gifts',
 *     'jubilee',
 *     10  // max step
 *   );
 *
 *   // Format for prompt injection
 *   const promptContext = retriever.formatForPrompt(results);
 */

const config = require('./config');
const { chunkStepFile, estimateTokens, detectContentType, extractPersonaScope } = require('./chunker');
const { generateEmbedding, generateEmbeddingsBatch, prepareTextForEmbedding } = require('./embedder');
const { InspireRetriever, quickRetrieve, getCollectionStats, RETRIEVAL_CONFIG } = require('./retriever');

module.exports = {
  // Configuration
  config,

  // Chunking utilities
  chunkStepFile,
  estimateTokens,
  detectContentType,
  extractPersonaScope,

  // Embedding utilities
  generateEmbedding,
  generateEmbeddingsBatch,
  prepareTextForEmbedding,

  // Retrieval
  InspireRetriever,
  quickRetrieve,
  getCollectionStats,
  RETRIEVAL_CONFIG,

  // Content types for filtering
  contentTypes: config.contentTypes,

  // Persona identifiers
  personas: config.personas
};
