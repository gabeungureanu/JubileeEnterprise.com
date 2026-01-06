/**
 * Conversation Model
 * Handles conversation persistence and retrieval
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert database row to conversation object
 */
function rowToConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    personaId: row.persona_id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    subjectLocked: row.subject_locked === true,
    userLanguage: row.user_language,
    responseLanguage: row.response_language,
    autoTranslate: row.auto_translate,
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at,
    contextSummary: row.context_summary,
    mailboxType: row.mailbox_type || 'chat_inbox',
    isFocused: row.is_focused !== false,
    isPrivate: row.is_private === true,
    markedPrivateAt: row.marked_private_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    personaName: row.persona_name,
    personaAvatar: row.persona_avatar
  };
}

/**
 * Create a new conversation
 */
async function create(data) {
  const id = uuidv4();
  const result = await database.query(
    `INSERT INTO conversations (id, user_id, persona_id, title, user_language, response_language, mailbox_type, is_focused, subject_locked)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      id,
      data.userId,
      data.personaId,
      data.title || 'New Conversation',
      data.userLanguage || 'en',
      data.responseLanguage || 'en',
      data.mailboxType || 'chat_inbox',
      data.isFocused !== false,
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
    `SELECT c.*, p.name as persona_name, p.avatar_url as persona_avatar
     FROM conversations c
     LEFT JOIN personas p ON c.persona_id = p.id
     WHERE c.id = $1`,
    [conversationId]
  );
  return rowToConversation(result.rows[0]);
}

/**
 * Find conversations by user ID with pagination
 */
async function findByUser(userId, options = {}) {
  const { limit = 50, offset = 0, status = 'active' } = options;

  const result = await database.query(
    `SELECT c.*, p.name as persona_name, p.avatar_url as persona_avatar,
            (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM conversations c
     LEFT JOIN personas p ON c.persona_id = p.id
     WHERE c.user_id = $1 AND c.status = $2
     ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, status, limit, offset]
  );

  return result.rows.map(row => ({
    ...rowToConversation(row),
    lastMessage: row.last_message
  }));
}

/**
 * Alias for findByUser (for backwards compatibility)
 */
const findByUserId = findByUser;

/**
 * Find conversations by user ID and mailbox type
 */
async function findByMailboxType(userId, mailboxType, options = {}) {
  const { limit = 50, offset = 0, status = 'active', focused = null } = options;

  let query = `
    SELECT c.*, p.name as persona_name, p.avatar_url as persona_avatar,
           (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM conversations c
    LEFT JOIN personas p ON c.persona_id = p.id
    WHERE c.user_id = $1 AND c.status = $2 AND c.mailbox_type = $3
  `;
  const params = [userId, status, mailboxType];

  if (focused !== null) {
    query += ` AND c.is_focused = $${params.length + 1}`;
    params.push(focused);
  }

  query += `
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  params.push(limit, offset);

  const result = await database.query(query, params);

  return result.rows.map(row => ({
    ...rowToConversation(row),
    lastMessage: row.last_message
  }));
}

/**
 * Count conversations by mailbox type
 */
async function countByMailboxType(userId, mailboxType, options = {}) {
  const { status = 'active', focused = null } = options;

  let query = `SELECT COUNT(*) FROM conversations WHERE user_id = $1 AND status = $2 AND mailbox_type = $3`;
  const params = [userId, status, mailboxType];

  if (focused !== null) {
    query += ` AND is_focused = $${params.length + 1}`;
    params.push(focused);
  }

  const result = await database.query(query, params);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Count conversations by user ID
 */
async function countByUserId(userId, status = 'active') {
  const result = await database.query(
    `SELECT COUNT(*) FROM conversations WHERE user_id = $1 AND status = $2`,
    [userId, status]
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
    contextSummary: 'context_summary',
    mailboxType: 'mailbox_type',
    isFocused: 'is_focused',
    isPrivate: 'is_private',
    markedPrivateAt: 'marked_private_at',
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
    `UPDATE conversations SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [conversationId, ...values]
  );
  return rowToConversation(result.rows[0]);
}

/**
 * Delete conversation (soft delete by changing status)
 */
async function remove(conversationId, userId) {
  await database.query(
    `UPDATE conversations SET status = 'deleted', updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return true;
}

/**
 * Delete conversation (hard delete)
 */
async function deleteConversation(conversationId) {
  const result = await database.query(
    `DELETE FROM conversations WHERE id = $1`,
    [conversationId]
  );
  if (result.rowCount === 0) {
    throw new Error('Conversation not found or already deleted');
  }
  return true;
}

/**
 * Update last message timestamp
 */
async function updateLastMessage(conversationId) {
  await database.query(
    `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );
  return true;
}

/**
 * Check if user owns conversation
 */
async function belongsToUser(conversationId, userId) {
  const result = await database.query(
    `SELECT id FROM conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Set conversation privacy status
 * When marked private, no analytics will be recorded or aggregated
 */
async function setPrivate(conversationId, isPrivate) {
  const result = await database.query(
    `UPDATE conversations
     SET is_private = $2,
         marked_private_at = CASE WHEN $2 = TRUE THEN NOW() ELSE NULL END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [conversationId, isPrivate]
  );
  return rowToConversation(result.rows[0]);
}

/**
 * Check if a conversation is marked as private
 */
async function isPrivate(conversationId) {
  const result = await database.query(
    `SELECT is_private FROM conversations WHERE id = $1`,
    [conversationId]
  );
  return result.rows[0]?.is_private === true;
}

/**
 * Find private conversations by user ID
 */
async function findPrivateByUser(userId, options = {}) {
  const { limit = 50, offset = 0, status = 'active' } = options;

  const result = await database.query(
    `SELECT c.*, p.name as persona_name, p.avatar_url as persona_avatar,
            (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM conversations c
     LEFT JOIN personas p ON c.persona_id = p.id
     WHERE c.user_id = $1 AND c.status = $2 AND c.is_private = TRUE
     ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, status, limit, offset]
  );

  return result.rows.map(row => ({
    ...rowToConversation(row),
    lastMessage: row.last_message
  }));
}

/**
 * Count private conversations by user ID
 */
async function countPrivateByUser(userId, status = 'active') {
  const result = await database.query(
    `SELECT COUNT(*) FROM conversations WHERE user_id = $1 AND status = $2 AND is_private = TRUE`,
    [userId, status]
  );
  return parseInt(result.rows[0].count, 10);
}

module.exports = {
  create,
  findById,
  findByUser,
  findByUserId,
  findByMailboxType,
  findPrivateByUser,
  countByUserId,
  countByMailboxType,
  countPrivateByUser,
  update,
  remove,
  delete: deleteConversation,
  updateLastMessage,
  belongsToUser,
  setPrivate,
  isPrivate
};
