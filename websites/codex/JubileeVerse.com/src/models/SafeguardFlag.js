/**
 * SafeguardFlag Model
 * Handles persistence and retrieval of safety flags
 *
 * PRIVACY ENFORCEMENT:
 * - All queries exclude private conversations
 * - Database triggers prevent insertion for private conversations
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert database row to safety flag object
 */
function rowToSafetyFlag(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    personaId: row.persona_id,
    sessionId: row.session_id,
    category: row.category,
    subcategory: row.subcategory,
    severity: row.severity,
    confidence: row.confidence,
    triggerType: row.trigger_type,
    evidenceTokens: row.evidence_tokens || [],
    internalSummary: row.internal_summary,
    personaResponseType: row.persona_response_type,
    personaResponseAppropriate: row.persona_response_appropriate,
    responseEvaluationNotes: row.response_evaluation_notes,
    alertGenerated: row.alert_generated,
    alertId: row.alert_id,
    privacyVerifiedAt: row.privacy_verified_at,
    analysisVersion: row.analysis_version,
    modelUsed: row.model_used,
    processingTimeMs: row.processing_time_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Create a new safety flag
 * PRIVACY: Database trigger will block if conversation is private
 */
async function create(flagData) {
  const id = uuidv4();

  try {
    const result = await database.query(`
      INSERT INTO safety_flags (
        id, user_id, conversation_id, message_id, persona_id, session_id,
        category, subcategory, severity, confidence,
        trigger_type, evidence_tokens, internal_summary,
        persona_response_type, persona_response_appropriate, response_evaluation_notes,
        analysis_version, model_used, processing_time_ms,
        privacy_verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      RETURNING *
    `, [
      id,
      flagData.userId,
      flagData.conversationId,
      flagData.messageId || null,
      flagData.personaId || null,
      flagData.sessionId || null,
      flagData.category,
      flagData.subcategory || null,
      flagData.severity || 'low',
      flagData.confidence,
      flagData.triggerType || 'user_message',
      flagData.evidenceTokens || [],
      flagData.internalSummary || null,
      flagData.personaResponseType || null,
      flagData.personaResponseAppropriate,
      flagData.responseEvaluationNotes || null,
      flagData.analysisVersion || '1.0',
      flagData.modelUsed || null,
      flagData.processingTimeMs || null
    ]);

    return rowToSafetyFlag(result.rows[0]);

  } catch (error) {
    if (error.message.includes('private conversations')) {
      return null; // Silently blocked by trigger
    }
    throw error;
  }
}

/**
 * Find safety flag by ID
 * PRIVACY: Excludes private conversations
 */
async function findById(flagId) {
  const result = await database.query(`
    SELECT sf.*
    FROM safety_flags sf
    JOIN conversations c ON sf.conversation_id = c.id
    WHERE sf.id = $1 AND c.is_private = FALSE
  `, [flagId]);

  return rowToSafetyFlag(result.rows[0]);
}

/**
 * Find safety flags by user ID with pagination
 * PRIVACY: Excludes private conversations
 */
async function findByUserId(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    category = null,
    severity = null,
    startDate = null,
    endDate = null
  } = options;

  let query = `
    SELECT sf.*
    FROM safety_flags sf
    JOIN conversations c ON sf.conversation_id = c.id
    WHERE sf.user_id = $1 AND c.is_private = FALSE
  `;
  const params = [userId];
  let paramIndex = 2;

  if (category) {
    query += ` AND sf.category = $${paramIndex++}`;
    params.push(category);
  }

  if (severity) {
    query += ` AND sf.severity = $${paramIndex++}`;
    params.push(severity);
  }

  if (startDate) {
    query += ` AND sf.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND sf.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  query += ` ORDER BY sf.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToSafetyFlag);
}

/**
 * Find safety flags by conversation ID
 * PRIVACY: Excludes private conversations
 */
async function findByConversationId(conversationId) {
  const result = await database.query(`
    SELECT sf.*
    FROM safety_flags sf
    JOIN conversations c ON sf.conversation_id = c.id
    WHERE sf.conversation_id = $1 AND c.is_private = FALSE
    ORDER BY sf.created_at DESC
  `, [conversationId]);

  return result.rows.map(rowToSafetyFlag);
}

/**
 * Find safety flags by persona ID
 * PRIVACY: Excludes private conversations
 */
async function findByPersonaId(personaId, options = {}) {
  const { limit = 100, offset = 0 } = options;

  const result = await database.query(`
    SELECT sf.*
    FROM safety_flags sf
    JOIN conversations c ON sf.conversation_id = c.id
    WHERE sf.persona_id = $1 AND c.is_private = FALSE
    ORDER BY sf.created_at DESC
    LIMIT $2 OFFSET $3
  `, [personaId, limit, offset]);

  return result.rows.map(rowToSafetyFlag);
}

/**
 * Count safety flags by category
 * PRIVACY: Excludes private conversations
 */
async function countByCategory(options = {}) {
  const { userId = null, personaId = null, startDate = null, endDate = null } = options;

  let query = `
    SELECT sf.category, sf.severity, COUNT(*) as count
    FROM safety_flags sf
    JOIN conversations c ON sf.conversation_id = c.id
    WHERE c.is_private = FALSE
  `;
  const params = [];
  let paramIndex = 1;

  if (userId) {
    query += ` AND sf.user_id = $${paramIndex++}`;
    params.push(userId);
  }

  if (personaId) {
    query += ` AND sf.persona_id = $${paramIndex++}`;
    params.push(personaId);
  }

  if (startDate) {
    query += ` AND sf.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND sf.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  query += ' GROUP BY sf.category, sf.severity ORDER BY count DESC';

  const result = await database.query(query, params);
  return result.rows;
}

/**
 * Get flags without alerts that meet threshold
 */
async function getFlagsNeedingAlerts(confidenceThreshold = 60) {
  const result = await database.query(`
    SELECT sf.*
    FROM safety_flags sf
    JOIN conversations c ON sf.conversation_id = c.id
    WHERE sf.alert_generated = FALSE
      AND sf.confidence >= $1
      AND c.is_private = FALSE
    ORDER BY sf.confidence DESC, sf.created_at ASC
  `, [confidenceThreshold]);

  return result.rows.map(rowToSafetyFlag);
}

/**
 * Update alert status for a flag
 */
async function updateAlertStatus(flagId, alertId) {
  const result = await database.query(`
    UPDATE safety_flags
    SET alert_generated = TRUE, alert_id = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [flagId, alertId]);

  return rowToSafetyFlag(result.rows[0]);
}

/**
 * Get aggregated stats for a time period
 * PRIVACY: Excludes private conversations
 */
async function getAggregatedStats(options = {}) {
  const { startDate, endDate, personaId = null } = options;

  let query = `
    SELECT
      sf.category,
      COUNT(*) as total_flags,
      COUNT(DISTINCT sf.user_id) as unique_users,
      COUNT(DISTINCT sf.conversation_id) as unique_conversations,
      AVG(sf.confidence) as avg_confidence,
      COUNT(*) FILTER (WHERE sf.severity = 'critical') as critical_count,
      COUNT(*) FILTER (WHERE sf.severity = 'high') as high_count,
      COUNT(*) FILTER (WHERE sf.severity = 'elevated') as elevated_count,
      COUNT(*) FILTER (WHERE sf.severity = 'moderate') as moderate_count,
      COUNT(*) FILTER (WHERE sf.severity = 'low') as low_count,
      COUNT(*) FILTER (WHERE sf.persona_response_appropriate = TRUE) as appropriate_response_count,
      COUNT(*) FILTER (WHERE sf.persona_response_appropriate = FALSE) as inappropriate_response_count
    FROM safety_flags sf
    JOIN conversations c ON sf.conversation_id = c.id
    WHERE c.is_private = FALSE
  `;
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    query += ` AND sf.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND sf.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  if (personaId) {
    query += ` AND sf.persona_id = $${paramIndex++}`;
    params.push(personaId);
  }

  query += ' GROUP BY sf.category ORDER BY total_flags DESC';

  const result = await database.query(query, params);
  return result.rows;
}

/**
 * Check if a similar flag exists recently (deduplication)
 */
async function existsSimilar(userId, conversationId, category, windowMinutes = 5) {
  const result = await database.query(`
    SELECT COUNT(*) as count
    FROM safety_flags sf
    JOIN conversations c ON sf.conversation_id = c.id
    WHERE sf.user_id = $1
      AND sf.conversation_id = $2
      AND sf.category = $3
      AND sf.created_at > NOW() - INTERVAL '${windowMinutes} minutes'
      AND c.is_private = FALSE
  `, [userId, conversationId, category]);

  return parseInt(result.rows[0].count, 10) > 0;
}

module.exports = {
  create,
  findById,
  findByUserId,
  findByConversationId,
  findByPersonaId,
  countByCategory,
  getFlagsNeedingAlerts,
  updateAlertStatus,
  getAggregatedStats,
  existsSimilar
};
