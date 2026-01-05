/**
 * Qdrant Service
 * Centralizes vector search and filtering logic for RAG retrieval.
 */

const config = require('../config');
const database = require('../database');
const logger = require('../utils/logger');
const AIService = require('./AIService');

const DEFAULT_MAX_STEP = 32;
const DEFAULT_LIMIT = 5;

function normalizePersonaKey(persona) {
  if (!persona) return null;
  const value = String(persona).trim();
  if (!value) return null;
  return value.split(/\s+/)[0].toLowerCase();
}

function toLowerArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).toLowerCase());
  }
  return [String(value).toLowerCase()];
}

function buildFilter({ personaKey, maxStep }) {
  const filter = {};

  if (Number.isFinite(maxStep)) {
    filter.must = [{ key: 'step_number', range: { lte: maxStep } }];
  }

  if (personaKey && personaKey !== 'all') {
    filter.should = [
      { key: 'persona_scope', match: { any: ['all', personaKey, 'collective'] } }
    ];
  }

  return Object.keys(filter).length > 0 ? filter : null;
}

function matchesPersonaScope(payload, personaKey) {
  if (!personaKey || personaKey === 'all') return true;

  const normalizedPersona = String(personaKey).toLowerCase();
  const scopeValues = toLowerArray(payload?.persona_scope);

  if (scopeValues.some((scope) => (
    scope === normalizedPersona || scope === 'all' || scope === 'collective'
  ))) {
    return true;
  }

  const subsubcategory = payload?.subsubcategory;
  if (typeof subsubcategory === 'string' && subsubcategory.toLowerCase() === normalizedPersona) {
    return true;
  }

  const path = payload?.path;
  if (typeof path === 'string' && path.toLowerCase().includes(`/${normalizedPersona}`)) {
    return true;
  }

  const personaField = payload?.persona || payload?.persona_name || payload?.persona_key;
  if (typeof personaField === 'string' && personaField.toLowerCase().includes(normalizedPersona)) {
    return true;
  }

  return false;
}

function extractPayloadText(payload) {
  if (!payload) return '';
  return payload.text || payload.content || payload.body || '';
}

function formatRetrievedKnowledge(results = []) {
  if (!results || results.length === 0) return '';

  return results.map((result) => {
    const payload = result.payload || {};
    const source = payload.source_file || payload.source || 'Inspire Knowledge';
    const step = payload.step_number ?? 'N/A';
    const contentType = payload.content_type || payload.type || 'instruction';
    const score = Number.isFinite(result.score) ? result.score.toFixed(2) : 'N/A';
    const text = extractPayloadText(payload);

    return `Source: ${source} (Step ${step}) | Type: ${contentType} | Score: ${score}
${text}`;
  }).join('\n\n---\n\n');
}

async function retrieveKnowledge(options = {}) {
  const {
    query,
    persona,
    collection = config.qdrant.collection,
    limit = config.qdrant.searchLimit || DEFAULT_LIMIT,
    scoreThreshold = config.qdrant.scoreThreshold,
    maxStep = Number.isFinite(config.qdrant.maxStep) ? config.qdrant.maxStep : DEFAULT_MAX_STEP,
    fallbackLimit = config.qdrant.searchFallbackLimit || Math.max(DEFAULT_LIMIT, (config.qdrant.searchLimit || DEFAULT_LIMIT) * 2)
  } = options;

  if (!query || !collection) {
    return { results: [], stats: { chunksRetrieved: 0, topScore: 0 } };
  }

  let qdrant;
  try {
    qdrant = database.getQdrant();
  } catch (error) {
    logger.warn('Qdrant client unavailable', { error: error.message });
    return { results: [], stats: { chunksRetrieved: 0, topScore: 0 } };
  }

  if (!qdrant || qdrant.mock) {
    logger.debug('Qdrant in mock mode - skipping retrieval');
    return { results: [], stats: { chunksRetrieved: 0, topScore: 0 } };
  }

  const personaKey = normalizePersonaKey(persona);
  const filter = buildFilter({ personaKey, maxStep });

  let embedding;
  try {
    embedding = await AIService.generateEmbedding(query);
  } catch (error) {
    logger.error('Failed to generate embedding for Qdrant search', { error: error.message });
    return { results: [], stats: { chunksRetrieved: 0, topScore: 0 } };
  }

  const searchPayload = {
    vector: embedding,
    limit,
    with_payload: true
  };

  if (filter) {
    searchPayload.filter = filter;
  }

  if (Number.isFinite(scoreThreshold)) {
    searchPayload.score_threshold = scoreThreshold;
  }

  let results = [];
  try {
    results = await qdrant.search(collection, searchPayload);
  } catch (error) {
    logger.error('Qdrant search failed', { error: error.message });
    results = [];
  }

  if (filter && (!results || results.length === 0)) {
    try {
      results = await qdrant.search(collection, {
        vector: embedding,
        limit: fallbackLimit,
        with_payload: true,
        ...(Number.isFinite(scoreThreshold) ? { score_threshold: scoreThreshold } : {})
      });
    } catch (error) {
      logger.error('Qdrant fallback search failed', { error: error.message });
      results = [];
    }
  }

  if (personaKey) {
    results = results.filter((result) => matchesPersonaScope(result.payload, personaKey));
  }

  if (Number.isFinite(scoreThreshold)) {
    results = results.filter((result) => Number.isFinite(result.score) && result.score >= scoreThreshold);
  }

  if (results.length > limit) {
    results = results.slice(0, limit);
  }

  const topScore = results[0]?.score || 0;

  return {
    results,
    stats: {
      chunksRetrieved: results.length,
      topScore
    }
  };
}

module.exports = {
  normalizePersonaKey,
  buildFilter,
  matchesPersonaScope,
  extractPayloadText,
  formatRetrievedKnowledge,
  retrieveKnowledge
};
