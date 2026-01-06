/**
 * Message Model
 * Handles message persistence and retrieval
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Convert database row to message object
 */
function rowToMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    type: row.role || row.type, // Support both 'role' (db) and 'type' (api)
    role: row.role || row.type,
    content: row.content,
    personaId: row.persona_id,
    personaSlug: row.persona_slug,
    personaName: row.persona_name,
    personaAvatar: row.persona_avatar,
    originalContent: row.original_content,
    originalLanguage: row.original_language,
    translatedTo: row.translated_to,
    tokenCount: row.token_count,
    processingTimeMs: row.processing_time_ms,
    modelUsed: row.model_used,
    modelVersion: row.model_version,
    status: row.status || 'delivered',
    errorMessage: row.error_message,
    requestId: row.request_id,
    bibleReferences: row.bible_references || [],
    createdAt: row.created_at
  };
}

/**
 * Create a new message
 */
async function create(data) {
  const id = uuidv4();
  const role = data.type || data.role || 'user';
  const personaId = data.personaId || data.metadata?.personaId || null;

  try {
    const result = await database.query(
      `WITH inserted AS (
         INSERT INTO messages (id, conversation_id, role, content, persona_id, model_used, model_version, token_count, processing_time_ms, request_id, bible_references, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'delivered', NOW())
         RETURNING *
       )
       SELECT inserted.*, p.name as persona_name, p.slug as persona_slug, p.avatar_url as persona_avatar
       FROM inserted
       LEFT JOIN personas p ON inserted.persona_id = p.id`,
      [
        id,
        data.conversationId,
        role,
        data.content,
        personaId,
        data.modelUsed || data.metadata?.modelUsed || null,
        data.modelVersion || data.metadata?.modelVersion || null,
        data.tokenCount || data.metadata?.tokenCount || null,
        data.processingTimeMs || data.metadata?.processingTimeMs || null,
        data.requestId || null,
        JSON.stringify(data.bibleReferences || data.metadata?.bibleReferences || [])
      ]
    );

    logger.debug('Message created', { messageId: id, conversationId: data.conversationId, role });

    return rowToMessage(result.rows[0]);
  } catch (error) {
    logger.error('Failed to create message', { error: error.message, conversationId: data.conversationId });
    throw error;
  }
}

/**
 * Find messages by conversation ID
 */
async function findByConversationId(conversationId, options = {}) {
  const { before = null, limit = 50, offset = 0, order = 'asc' } = options;

  try {
    let query = `
      SELECT m.*, p.name as persona_name, p.slug as persona_slug, p.avatar_url as persona_avatar
      FROM messages m
      LEFT JOIN personas p ON m.persona_id = p.id
      WHERE m.conversation_id = $1`;
    const params = [conversationId];

    if (before) {
      query += ` AND m.created_at < $2`;
      params.push(before);
    }

    query += ` ORDER BY m.created_at ${order === 'desc' ? 'DESC' : 'ASC'}`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await database.query(query, params);

    return result.rows.map(rowToMessage);
  } catch (error) {
    logger.error('Failed to find messages', { error: error.message, conversationId });
    throw error;
  }
}

/**
 * Find messages by conversation (alias for backwards compatibility)
 */
const findByConversation = findByConversationId;

/**
 * Find message by ID
 */
async function findById(messageId) {
  try {
    const result = await database.query(
      `SELECT m.*, p.name as persona_name, p.slug as persona_slug, p.avatar_url as persona_avatar
       FROM messages m
       LEFT JOIN personas p ON m.persona_id = p.id
       WHERE m.id = $1`,
      [messageId]
    );
    return rowToMessage(result.rows[0]);
  } catch (error) {
    logger.error('Failed to find message', { error: error.message, messageId });
    throw error;
  }
}

/**
 * Count messages in conversation
 */
async function countByConversationId(conversationId) {
  try {
    const result = await database.query(
      `SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1`,
      [conversationId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Failed to count messages', { error: error.message, conversationId });
    throw error;
  }
}

/**
 * Count messages by conversation ID and role
 */
async function countByConversationAndRole(conversationId, role) {
  try {
    const result = await database.query(
      `SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1 AND role = $2`,
      [conversationId, role]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Failed to count messages by role', { error: error.message, conversationId, role });
    throw error;
  }
}

/**
 * Find messages by conversation ID and role
 */
async function findByConversationAndRole(conversationId, role, options = {}) {
  const { limit = 50, offset = 0, order = 'asc' } = options;

  try {
    const result = await database.query(
      `SELECT m.*, p.name as persona_name, p.slug as persona_slug, p.avatar_url as persona_avatar
       FROM messages m
       LEFT JOIN personas p ON m.persona_id = p.id
       WHERE m.conversation_id = $1 AND m.role = $2
       ORDER BY m.created_at ${order === 'desc' ? 'DESC' : 'ASC'}
       LIMIT $3 OFFSET $4`,
      [conversationId, role, limit, offset]
    );

    return result.rows.map(rowToMessage);
  } catch (error) {
    logger.error('Failed to find messages by role', { error: error.message, conversationId, role });
    throw error;
  }
}

/**
 * Find latest message by conversation ID and role
 */
async function findLatestByConversationAndRole(conversationId, role) {
  const results = await findByConversationAndRole(conversationId, role, { limit: 1, order: 'desc' });
  return results[0] || null;
}

/**
 * Get last message in conversation
 */
async function getLastMessage(conversationId) {
  try {
    const result = await database.query(
      `SELECT m.*, p.name as persona_name, p.slug as persona_slug, p.avatar_url as persona_avatar
       FROM messages m
       LEFT JOIN personas p ON m.persona_id = p.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [conversationId]
    );
    return rowToMessage(result.rows[0]);
  } catch (error) {
    logger.error('Failed to get last message', { error: error.message, conversationId });
    throw error;
  }
}

/**
 * Find latest message by conversation (alias)
 */
const findLatestByConversation = getLastMessage;

/**
 * Delete messages by conversation ID
 */
async function deleteByConversationId(conversationId) {
  try {
    await database.query(
      `DELETE FROM messages WHERE conversation_id = $1`,
      [conversationId]
    );
    logger.debug('Messages deleted', { conversationId });
    return true;
  } catch (error) {
    logger.error('Failed to delete messages', { error: error.message, conversationId });
    throw error;
  }
}

/**
 * Delete messages by conversation (alias)
 */
const deleteByConversation = deleteByConversationId;

/**
 * Update message metadata
 */
async function updateMetadata(messageId, metadata) {
  try {
    const result = await database.query(
      `UPDATE messages SET metadata = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [messageId, JSON.stringify(metadata)]
    );
    return rowToMessage(result.rows[0]);
  } catch (error) {
    logger.error('Failed to update message metadata', { error: error.message, messageId });
    throw error;
  }
}

/**
 * Add attachment to message
 */
async function addAttachment(messageId, attachment) {
  try {
    const message = await findById(messageId);
    if (!message) throw new Error('Message not found');

    const attachments = message.attachments || [];
    attachments.push({
      ...attachment,
      id: uuidv4(),
      addedAt: new Date().toISOString()
    });

    const result = await database.query(
      `UPDATE messages SET attachments = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [messageId, JSON.stringify(attachments)]
    );

    return rowToMessage(result.rows[0]);
  } catch (error) {
    logger.error('Failed to add attachment', { error: error.message, messageId });
    throw error;
  }
}

/**
 * Search messages within a conversation
 */
async function searchInConversation(conversationId, query, options = {}) {
  const { limit = 20 } = options;

  try {
    const result = await database.query(
      `SELECT m.*, p.name as persona_name, p.slug as persona_slug, p.avatar_url as persona_avatar
       FROM messages m
       LEFT JOIN personas p ON m.persona_id = p.id
       WHERE m.conversation_id = $1 AND m.content ILIKE $2
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [conversationId, `%${query}%`, limit]
    );

    return result.rows.map(rowToMessage);
  } catch (error) {
    logger.error('Failed to search messages', { error: error.message, conversationId, query });
    throw error;
  }
}

/**
 * Get messages with attachments that are older than retention period
 */
async function findMessagesWithExpiredAttachments(retentionDays = 30) {
  try {
    const result = await database.query(
      `SELECT * FROM messages
       WHERE attachments IS NOT NULL
       AND attachments != '[]'::jsonb
       AND created_at < NOW() - INTERVAL '${retentionDays} days'`
    );
    return result.rows.map(rowToMessage);
  } catch (error) {
    logger.error('Failed to find messages with expired attachments', { error: error.message });
    throw error;
  }
}

/**
 * Clear attachments from message (retention policy)
 */
async function clearAttachments(messageId) {
  try {
    const result = await database.query(
      `UPDATE messages SET attachments = '[]'::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [messageId]
    );
    return rowToMessage(result.rows[0]);
  } catch (error) {
    logger.error('Failed to clear attachments', { error: error.message, messageId });
    throw error;
  }
}

module.exports = {
  create,
  findByConversationId,
  findByConversation,
  findById,
  countByConversationId,
  countByConversationAndRole,
  findByConversationAndRole,
  findLatestByConversationAndRole,
  getLastMessage,
  findLatestByConversation,
  deleteByConversationId,
  deleteByConversation,
  updateMetadata,
  addAttachment,
  searchInConversation,
  findMessagesWithExpiredAttachments,
  clearAttachments
};
