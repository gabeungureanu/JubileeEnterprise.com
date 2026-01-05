/**
 * Community Conversation Model
 * Handles community inbox conversations (private chats within a community context)
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert database row to community conversation object
 */
function rowToConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    personaId: row.persona_id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    subjectLocked: row.subject_locked === true,
    userLanguage: row.user_language,
    responseLanguage: row.response_language,
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    personaName: row.persona_name,
    personaAvatar: row.persona_avatar,
    communityName: row.community_name,
    lastMessage: row.last_message
  };
}

/**
 * Convert database row to message object
 */
function rowToMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    personaId: row.persona_id,
    personaName: row.persona_name,
    originalContent: row.original_content,
    originalLanguage: row.original_language,
    translatedTo: row.translated_to,
    tokenCount: row.token_count,
    modelUsed: row.model_used,
    status: row.status,
    bibleReferences: row.bible_references,
    createdAt: row.created_at
  };
}

/**
 * Create a new community conversation
 */
async function create(data) {
  const id = uuidv4();
  const result = await database.query(
    `INSERT INTO community_conversations
     (id, community_id, user_id, persona_id, title, user_language, response_language, subject_locked)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      data.communityId,
      data.userId,
      data.personaId || null,
      data.title || 'New Conversation',
      data.userLanguage || 'en',
      data.responseLanguage || 'en',
      data.subjectLocked === true
    ]
  );
  return rowToConversation(result.rows[0]);
}

/**
 * Find conversation by ID
 */
async function findById(conversationId) {
  const result = await database.query(
    `SELECT cc.*,
            p.name as persona_name, p.avatar_url as persona_avatar,
            c.name as community_name
     FROM community_conversations cc
     LEFT JOIN personas p ON cc.persona_id = p.id
     LEFT JOIN communities c ON cc.community_id = c.id
     WHERE cc.id = $1`,
    [conversationId]
  );
  return rowToConversation(result.rows[0]);
}

/**
 * Find conversations by user and community with pagination
 */
async function findByUserAndCommunity(userId, communityId, options = {}) {
  const { limit = 50, offset = 0, status = 'active' } = options;

  const result = await database.query(
    `SELECT cc.*,
            p.name as persona_name, p.avatar_url as persona_avatar,
            c.name as community_name,
            (SELECT content FROM community_messages WHERE conversation_id = cc.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM community_conversations cc
     LEFT JOIN personas p ON cc.persona_id = p.id
     LEFT JOIN communities c ON cc.community_id = c.id
     WHERE cc.user_id = $1 AND cc.community_id = $2 AND cc.status = $3
     ORDER BY cc.last_message_at DESC NULLS LAST, cc.created_at DESC
     LIMIT $4 OFFSET $5`,
    [userId, communityId, status, limit, offset]
  );

  return result.rows.map(rowToConversation);
}

/**
 * Count conversations by user and community
 */
async function countByUserAndCommunity(userId, communityId, status = 'active') {
  const result = await database.query(
    `SELECT COUNT(*) FROM community_conversations
     WHERE user_id = $1 AND community_id = $2 AND status = $3`,
    [userId, communityId, status]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Update conversation
 */
async function update(conversationId, updates) {
  const fieldMap = {
    title: 'title',
    summary: 'summary',
    status: 'status',
    subjectLocked: 'subject_locked',
    personaId: 'persona_id',
    userLanguage: 'user_language',
    responseLanguage: 'response_language'
  };

  const dbUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key] || key;
    dbUpdates[dbField] = value;
  }

  const fields = Object.keys(dbUpdates);
  const values = Object.values(dbUpdates);

  if (fields.length === 0) return findById(conversationId);

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

  const result = await database.query(
    `UPDATE community_conversations SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [conversationId, ...values]
  );
  return rowToConversation(result.rows[0]);
}

/**
 * Delete conversation (soft delete)
 */
async function remove(conversationId, userId) {
  await database.query(
    `UPDATE community_conversations SET status = 'deleted', updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return true;
}

/**
 * Check if user owns conversation
 */
async function belongsToUser(conversationId, userId) {
  const result = await database.query(
    `SELECT id FROM community_conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows.length > 0;
}

// ==================== MESSAGES ====================

/**
 * Create a message in a community conversation
 */
async function createMessage(data) {
  const id = uuidv4();
  const result = await database.query(
    `INSERT INTO community_messages
     (id, conversation_id, role, content, persona_id, original_content, original_language, translated_to, token_count, model_used, bible_references)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      id,
      data.conversationId,
      data.role,
      data.content,
      data.personaId || null,
      data.originalContent || null,
      data.originalLanguage || null,
      data.translatedTo || null,
      data.tokenCount || null,
      data.modelUsed || null,
      JSON.stringify(data.bibleReferences || [])
    ]
  );

  // Join with persona to get name
  const messageWithPersona = await database.query(
    `SELECT cm.*, p.name as persona_name
     FROM community_messages cm
     LEFT JOIN personas p ON cm.persona_id = p.id
     WHERE cm.id = $1`,
    [id]
  );

  return rowToMessage(messageWithPersona.rows[0]);
}

/**
 * Get messages for a conversation
 */
async function getMessages(conversationId, options = {}) {
  const { limit = 100, offset = 0, order = 'asc' } = options;
  const orderDir = order === 'desc' ? 'DESC' : 'ASC';

  const result = await database.query(
    `SELECT cm.*, p.name as persona_name
     FROM community_messages cm
     LEFT JOIN personas p ON cm.persona_id = p.id
     WHERE cm.conversation_id = $1 AND cm.status = 'delivered'
     ORDER BY cm.created_at ${orderDir}
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );

  return result.rows.map(rowToMessage);
}

/**
 * Count messages in a conversation
 */
async function countMessages(conversationId) {
  const result = await database.query(
    `SELECT COUNT(*) FROM community_messages WHERE conversation_id = $1 AND status = 'delivered'`,
    [conversationId]
  );
  return parseInt(result.rows[0].count, 10);
}

module.exports = {
  // Conversations
  create,
  findById,
  findByUserAndCommunity,
  countByUserAndCommunity,
  update,
  remove,
  belongsToUser,

  // Messages
  createMessage,
  getMessages,
  countMessages
};
