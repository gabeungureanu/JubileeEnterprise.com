/**
 * Discussion Board Model
 * Handles discussion boards, conversations, and shared community spaces
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Default persona mappings for discussion boards
 */
const BOARD_PERSONA_MAP = {
  'kingdom-builder': 'elias',
  'creative-fire': 'santiago',
  'gospel-pulse': 'jubilee',
  'shepherds-voice': 'caleb',
  'hebraic-roots': 'zev'
};

/**
 * Convert database row to board object
 */
function rowToBoard(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    defaultPersonaId: row.default_persona_id,
    boardType: row.board_type,
    isActive: row.is_active,
    iconUrl: row.icon_url,
    bannerUrl: row.banner_url,
    themeColor: row.theme_color,
    requiresMembership: row.requires_membership,
    minMembershipLevel: row.min_membership_level,
    memberCount: row.member_count,
    postCount: row.post_count,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Convert database row to board conversation object
 */
function rowToBoardConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    boardId: row.board_id,
    communityId: row.community_id,
    authorId: row.author_id,
    title: row.title,
    description: row.description,
    personaId: row.persona_id,
    status: row.status,
    isPinned: row.is_pinned,
    isLocked: row.is_locked,
    viewCount: row.view_count,
    replyCount: row.reply_count,
    participantCount: row.participant_count,
    lastReplyAt: row.last_reply_at,
    lastReplyUserId: row.last_reply_user_id,
    aiResponseCount: row.ai_response_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    authorName: row.author_name,
    boardName: row.board_name,
    personaName: row.persona_name
  };
}

/**
 * Convert database row to board message object
 */
function rowToBoardMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    boardConversationId: row.board_conversation_id,
    authorId: row.author_id,
    personaId: row.persona_id,
    isAiResponse: row.is_ai_response,
    content: row.content,
    parentMessageId: row.parent_message_id,
    replyDepth: row.reply_depth,
    status: row.status,
    flaggedReason: row.flagged_reason,
    moderatedBy: row.moderated_by,
    moderatedAt: row.moderated_at,
    likeCount: row.like_count,
    modelUsed: row.model_used,
    tokenCount: row.token_count,
    bibleReferences: row.bible_references || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    authorName: row.author_name,
    personaName: row.persona_name
  };
}

// ==========================================
// Discussion Board Functions
// ==========================================

/**
 * Get all active discussion boards
 */
async function getAllBoards(options = {}) {
  const { includeInactive = false, limit = 50, offset = 0 } = options;

  try {
    let query = `
      SELECT db.*, p.name as persona_name
      FROM discussion_boards db
      LEFT JOIN personas p ON db.default_persona_id = p.id
    `;

    if (!includeInactive) {
      query += ` WHERE db.is_active = TRUE`;
    }

    query += ` ORDER BY db.name ASC LIMIT $1 OFFSET $2`;

    const result = await database.query(query, [limit, offset]);
    return result.rows.map(rowToBoard);
  } catch (error) {
    logger.error('Failed to get boards', { error: error.message });
    throw error;
  }
}

/**
 * Get board by ID
 */
async function getBoardById(boardId) {
  try {
    const result = await database.query(
      `SELECT db.*, p.name as persona_name
       FROM discussion_boards db
       LEFT JOIN personas p ON db.default_persona_id = p.id
       WHERE db.id = $1`,
      [boardId]
    );
    return rowToBoard(result.rows[0]);
  } catch (error) {
    logger.error('Failed to get board', { error: error.message, boardId });
    throw error;
  }
}

/**
 * Get board by slug
 */
async function getBoardBySlug(slug) {
  try {
    const result = await database.query(
      `SELECT db.*, p.name as persona_name
       FROM discussion_boards db
       LEFT JOIN personas p ON db.default_persona_id = p.id
       WHERE db.slug = $1`,
      [slug]
    );
    return rowToBoard(result.rows[0]);
  } catch (error) {
    logger.error('Failed to get board by slug', { error: error.message, slug });
    throw error;
  }
}

/**
 * Get default persona for a board
 */
function getDefaultPersonaSlug(boardSlug) {
  return BOARD_PERSONA_MAP[boardSlug] || 'jubilee';
}

// ==========================================
// Board Membership Functions
// ==========================================

/**
 * Join a board
 */
async function joinBoard(boardId, userId, role = 'member') {
  try {
    const result = await database.query(
      `INSERT INTO board_memberships (board_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (board_id, user_id) DO UPDATE SET role = $3
       RETURNING *`,
      [boardId, userId, role]
    );

    // Update member count
    await database.query(
      `UPDATE discussion_boards
       SET member_count = (SELECT COUNT(*) FROM board_memberships WHERE board_id = $1)
       WHERE id = $1`,
      [boardId]
    );

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to join board', { error: error.message, boardId, userId });
    throw error;
  }
}

/**
 * Leave a board
 */
async function leaveBoard(boardId, userId) {
  try {
    await database.query(
      `DELETE FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
      [boardId, userId]
    );

    // Update member count
    await database.query(
      `UPDATE discussion_boards
       SET member_count = (SELECT COUNT(*) FROM board_memberships WHERE board_id = $1)
       WHERE id = $1`,
      [boardId]
    );

    return true;
  } catch (error) {
    logger.error('Failed to leave board', { error: error.message, boardId, userId });
    throw error;
  }
}

/**
 * Check if user is member of board
 */
async function isMember(boardId, userId) {
  try {
    const result = await database.query(
      `SELECT id, role FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
      [boardId, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Failed to check membership', { error: error.message, boardId, userId });
    throw error;
  }
}

/**
 * Get user's boards
 */
async function getUserBoards(userId) {
  try {
    const result = await database.query(
      `SELECT db.*, bm.role as user_role, bm.joined_at
       FROM discussion_boards db
       JOIN board_memberships bm ON db.id = bm.board_id
       WHERE bm.user_id = $1 AND db.is_active = TRUE
       ORDER BY bm.joined_at DESC`,
      [userId]
    );
    return result.rows.map(row => ({
      ...rowToBoard(row),
      userRole: row.user_role,
      joinedAt: row.joined_at
    }));
  } catch (error) {
    logger.error('Failed to get user boards', { error: error.message, userId });
    throw error;
  }
}

// ==========================================
// Board Conversation Functions
// ==========================================

/**
 * Create a new board conversation
 */
async function createConversation(data) {
  const id = uuidv4();

  try {
    const result = await database.query(
      `INSERT INTO board_conversations (id, board_id, community_id, author_id, title, description, persona_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, data.boardId, data.communityId || null, data.authorId, data.title, data.description || null, data.personaId || null]
    );

    logger.debug('Board conversation created', { conversationId: id, boardId: data.boardId });

    return rowToBoardConversation(result.rows[0]);
  } catch (error) {
    logger.error('Failed to create board conversation', { error: error.message, boardId: data.boardId });
    throw error;
  }
}

/**
 * Get conversations for a board
 */
async function getBoardConversations(boardId, options = {}) {
  const { limit = 50, offset = 0, status = 'active', includePinned = true, communityId = null } = options;

  try {
    let query = `
      SELECT bc.*, u.display_name as author_name, p.name as persona_name
      FROM board_conversations bc
      LEFT JOIN users u ON bc.author_id = u.id
      LEFT JOIN personas p ON bc.persona_id = p.id
      WHERE bc.board_id = $1 AND bc.status = $2
    `;
    const params = [boardId, status];

    if (communityId) {
      query += ` AND bc.community_id = $3`;
      params.push(communityId);
    }

    if (includePinned) {
      query += ` ORDER BY bc.is_pinned DESC, bc.last_reply_at DESC NULLS LAST, bc.created_at DESC`;
    } else {
      query += ` ORDER BY bc.last_reply_at DESC NULLS LAST, bc.created_at DESC`;
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await database.query(query, params);
    return result.rows.map(rowToBoardConversation);
  } catch (error) {
    logger.error('Failed to get board conversations', { error: error.message, boardId });
    throw error;
  }
}

/**
 * Get a board conversation by ID
 */
async function getConversationById(conversationId) {
  try {
    const result = await database.query(
      `SELECT bc.*, u.display_name as author_name, p.name as persona_name, db.name as board_name
       FROM board_conversations bc
       LEFT JOIN users u ON bc.author_id = u.id
       LEFT JOIN personas p ON bc.persona_id = p.id
       LEFT JOIN discussion_boards db ON bc.board_id = db.id
       WHERE bc.id = $1`,
      [conversationId]
    );

    // Increment view count
    if (result.rows[0]) {
      await database.query(
        `UPDATE board_conversations SET view_count = view_count + 1 WHERE id = $1`,
        [conversationId]
      );
    }

    return rowToBoardConversation(result.rows[0]);
  } catch (error) {
    logger.error('Failed to get board conversation', { error: error.message, conversationId });
    throw error;
  }
}

// ==========================================
// Board Message Functions
// ==========================================

/**
 * Create a board message
 */
async function createMessage(data) {
  const id = uuidv4();

  try {
    // Insert the message
    await database.query(
      `INSERT INTO board_messages (id, board_conversation_id, author_id, persona_id, is_ai_response, content, parent_message_id, reply_depth, model_used, token_count, bible_references)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        data.boardConversationId,
        data.authorId || null,
        data.personaId || null,
        data.isAiResponse || false,
        data.content,
        data.parentMessageId || null,
        data.replyDepth || 0,
        data.modelUsed || null,
        data.tokenCount || null,
        JSON.stringify(data.bibleReferences || [])
      ]
    );

    // Fetch the message with joined author name and persona name
    const result = await database.query(
      `SELECT bm.*, u.display_name as author_name, p.name as persona_name
       FROM board_messages bm
       LEFT JOIN users u ON bm.author_id = u.id
       LEFT JOIN personas p ON bm.persona_id = p.id
       WHERE bm.id = $1`,
      [id]
    );

    // Update participant count if this is a new author
    if (data.authorId) {
      await database.query(
        `UPDATE board_conversations
         SET participant_count = (
           SELECT COUNT(DISTINCT author_id)
           FROM board_messages
           WHERE board_conversation_id = $1 AND author_id IS NOT NULL
         )
         WHERE id = $1`,
        [data.boardConversationId]
      );
    }

    logger.debug('Board message created', { messageId: id, conversationId: data.boardConversationId });

    return rowToBoardMessage(result.rows[0]);
  } catch (error) {
    logger.error('Failed to create board message', { error: error.message });
    throw error;
  }
}

/**
 * Get messages for a board conversation
 */
async function getConversationMessages(conversationId, options = {}) {
  const { limit = 100, offset = 0, order = 'asc' } = options;

  try {
    const result = await database.query(
      `SELECT bm.*, u.display_name as author_name, p.name as persona_name
       FROM board_messages bm
       LEFT JOIN users u ON bm.author_id = u.id
       LEFT JOIN personas p ON bm.persona_id = p.id
       WHERE bm.board_conversation_id = $1 AND bm.status = 'visible'
       ORDER BY bm.created_at ${order === 'desc' ? 'DESC' : 'ASC'}
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    return result.rows.map(rowToBoardMessage);
  } catch (error) {
    logger.error('Failed to get conversation messages', { error: error.message, conversationId });
    throw error;
  }
}

/**
 * Like a message
 */
async function likeMessage(messageId, userId) {
  try {
    await database.query(
      `INSERT INTO board_message_likes (message_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [messageId, userId]
    );
    return true;
  } catch (error) {
    logger.error('Failed to like message', { error: error.message, messageId, userId });
    throw error;
  }
}

/**
 * Unlike a message
 */
async function unlikeMessage(messageId, userId) {
  try {
    await database.query(
      `DELETE FROM board_message_likes WHERE message_id = $1 AND user_id = $2`,
      [messageId, userId]
    );
    return true;
  } catch (error) {
    logger.error('Failed to unlike message', { error: error.message, messageId, userId });
    throw error;
  }
}

/**
 * Check if user has liked a message
 */
async function hasUserLiked(messageId, userId) {
  try {
    const result = await database.query(
      `SELECT id FROM board_message_likes WHERE message_id = $1 AND user_id = $2`,
      [messageId, userId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Failed to check like status', { error: error.message, messageId, userId });
    throw error;
  }
}

// ==========================================
// Search Functions
// ==========================================

/**
 * Search board conversations
 */
async function searchConversations(boardId, query, options = {}) {
  const { limit = 20, communityId = null } = options;

  try {
    let sql = `
      SELECT bc.*, u.display_name as author_name
      FROM board_conversations bc
      LEFT JOIN users u ON bc.author_id = u.id
      WHERE bc.board_id = $1
      AND (bc.title ILIKE $2 OR bc.description ILIKE $2)
      AND bc.status = 'active'`;
    const params = [boardId, `%${query}%`];

    if (communityId) {
      sql += ` AND bc.community_id = $3`;
      params.push(communityId);
    }

    sql += ` ORDER BY bc.last_reply_at DESC NULLS LAST LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await database.query(sql, params);
    return result.rows.map(rowToBoardConversation);
  } catch (error) {
    logger.error('Failed to search conversations', { error: error.message, boardId, query });
    throw error;
  }
}

/**
 * Search board messages (full-text)
 */
async function searchMessages(boardId, query, options = {}) {
  const { limit = 50, communityId = null } = options;

  try {
    let sql = `
      SELECT bm.*, bc.title as conversation_title, u.display_name as author_name
      FROM board_messages bm
      JOIN board_conversations bc ON bm.board_conversation_id = bc.id
      LEFT JOIN users u ON bm.author_id = u.id
      WHERE bc.board_id = $1
      AND to_tsvector('english', bm.content) @@ plainto_tsquery('english', $2)
      AND bm.status = 'visible'`;
    const params = [boardId, query];

    if (communityId) {
      sql += ` AND bc.community_id = $3`;
      params.push(communityId);
    }

    sql += ` ORDER BY ts_rank(to_tsvector('english', bm.content), plainto_tsquery('english', $2)) DESC`;
    sql += ` LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await database.query(sql, params);
    return result.rows.map(row => ({
      ...rowToBoardMessage(row),
      conversationTitle: row.conversation_title
    }));
  } catch (error) {
    logger.error('Failed to search messages', { error: error.message, boardId, query });
    throw error;
  }
}

// ==========================================
// Delete Functions
// ==========================================

/**
 * Delete message translations for given message IDs
 */
async function deleteMessageTranslations(messageIds) {
  if (!messageIds || messageIds.length === 0) return 0;
  try {
    const result = await database.query(
      `DELETE FROM board_message_translations WHERE board_message_id = ANY($1)`,
      [messageIds]
    );
    logger.info('Deleted message translations', { count: result.rowCount, messageIds });
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to delete message translations', { error: error.message, messageIds });
    throw error;
  }
}

/**
 * Delete all messages in a conversation
 */
async function deleteConversationMessages(conversationId) {
  try {
    // First delete any message likes
    await database.query(
      `DELETE FROM board_message_likes WHERE message_id IN (
        SELECT id FROM board_messages WHERE board_conversation_id = $1
      )`,
      [conversationId]
    );
    // Then delete messages
    const result = await database.query(
      `DELETE FROM board_messages WHERE board_conversation_id = $1`,
      [conversationId]
    );
    logger.info('Deleted conversation messages', { conversationId, count: result.rowCount });
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to delete conversation messages', { error: error.message, conversationId });
    throw error;
  }
}

/**
 * Delete a conversation
 */
async function deleteConversation(conversationId) {
  try {
    const result = await database.query(
      `DELETE FROM board_conversations WHERE id = $1`,
      [conversationId]
    );
    logger.info('Deleted conversation', { conversationId });
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Failed to delete conversation', { error: error.message, conversationId });
    throw error;
  }
}

module.exports = {
  // Boards
  getAllBoards,
  getBoardById,
  getBoardBySlug,
  getDefaultPersonaSlug,
  BOARD_PERSONA_MAP,

  // Membership
  joinBoard,
  leaveBoard,
  isMember,
  getUserBoards,

  // Conversations
  createConversation,
  getBoardConversations,
  getConversationById,
  deleteConversation,

  // Messages
  createMessage,
  getConversationMessages,
  likeMessage,
  unlikeMessage,
  hasUserLiked,
  deleteMessageTranslations,
  deleteConversationMessages,

  // Search
  searchConversations,
  searchMessages
};
