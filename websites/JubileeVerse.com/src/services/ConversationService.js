/**
 * Conversation Service
 * Handles conversation management, message handling, and context assembly
 */

const config = require('../config');
const logger = require('../utils/logger');
const database = require('../database');
const { Conversation, Message, User } = require('../models');
const PersonaService = require('./PersonaService');
const AIService = require('./AIService');
const { getFirstNameFromUser } = require('../utils/name');

const SUBJECT_MAX_LENGTH = 70;
const CHAT_INBOX_DEFAULT_PERSONA_SLUG = 'jubilee';
const CHAT_INBOX_WELCOME_TITLE = 'Welcome to your Chat Inbox';

function normalizeSubjectLine(subject) {
  if (!subject) return '';
  const cleaned = subject
    .replace(/[\r\n]+/g, ' ')
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length <= SUBJECT_MAX_LENGTH) return cleaned;
  return cleaned.substring(0, SUBJECT_MAX_LENGTH).trim();
}

function buildChatInboxGreeting(firstName, personaName) {
  const name = firstName || 'friend';
  const speaker = personaName || 'Jubilee Inspire';
  return `Shalom ${name}! I'm ${speaker}. Welcome to your private Chat Inbox, a personal space for one-to-one or multi-persona conversations with AI Bible personas. Ask anything about Scripture, faith, or prayer, and I'm honored to walk with you.`;
}

async function resolveUserForGreeting(userId, userInfo) {
  if (userInfo && (userInfo.displayName || userInfo.email)) {
    return userInfo;
  }

  if (!userId) {
    return userInfo || null;
  }

  try {
    return await User.findById(userId);
  } catch (error) {
    logger.warn('Failed to resolve user for greeting', { userId, error: error.message });
    return userInfo || null;
  }
}

async function resolvePersonaForGreeting() {
  try {
    return await PersonaService.getPersonaBySlug(CHAT_INBOX_DEFAULT_PERSONA_SLUG);
  } catch (error) {
    logger.warn('Default chat inbox persona not found', { slug: CHAT_INBOX_DEFAULT_PERSONA_SLUG });
  }

  try {
    const personas = await PersonaService.getAllPersonas({ activeOnly: true });
    return personas[0] || null;
  } catch (error) {
    logger.warn('Failed to resolve fallback persona', { error: error.message });
    return null;
  }
}

async function generateAiSubjectLine(contextText) {
  if (!contextText) return null;
  const provider = AIService.getDefaultProvider();
  if (!AIService.isProviderAvailable(provider)) {
    return null;
  }

  const systemPrompt = [
    'Create a concise email subject line for the conversation.',
    'Return a single line only, no quotes, no markdown.',
    'Do not include persona names or speaker labels.',
    `Maximum ${SUBJECT_MAX_LENGTH} characters including spaces.`,
    'Summarize the overall discussion topic.'
  ].join('\n');

  const response = await AIService.generateResponse({
    provider,
    systemPrompt,
    messages: [{ type: 'user', content: contextText }],
    maxTokens: 64,
    temperature: 0.2
  });

  return normalizeSubjectLine(response);
}

async function upsertConversationPersonas(conversationId, personaIds = []) {
  if (!personaIds.length) return;
  await database.query(
    `INSERT INTO conversation_personas (conversation_id, persona_id, last_used_at)
     SELECT $1, unnest($2::uuid[]), NOW()
     ON CONFLICT (conversation_id, persona_id)
     DO UPDATE SET last_used_at = EXCLUDED.last_used_at`,
    [conversationId, personaIds]
  );
}

async function getConversationPersonaIds(conversationId) {
  const result = await database.query(
    `SELECT persona_id
     FROM conversation_personas
     WHERE conversation_id = $1
     ORDER BY last_used_at DESC NULLS LAST, added_at ASC`,
    [conversationId]
  );
  return result.rows.map(row => row.persona_id);
}

async function getConversationPersonas(conversationId) {
  const result = await database.query(
    `SELECT p.id, p.slug, p.name, p.avatar_url
     FROM conversation_personas cp
     JOIN personas p ON p.id = cp.persona_id
     WHERE cp.conversation_id = $1
     ORDER BY cp.last_used_at DESC NULLS LAST, cp.added_at ASC`,
    [conversationId]
  );
  return result.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    avatar: row.avatar_url
  }));
}

async function getConversationPersonasMap(conversationIds = []) {
  if (conversationIds.length === 0) return new Map();
  const result = await database.query(
    `SELECT cp.conversation_id, p.id, p.slug, p.name, p.avatar_url
     FROM conversation_personas cp
     JOIN personas p ON p.id = cp.persona_id
     WHERE cp.conversation_id = ANY($1::uuid[])
     ORDER BY cp.last_used_at DESC NULLS LAST, cp.added_at ASC`,
    [conversationIds]
  );

  const map = new Map();
  result.rows.forEach(row => {
    if (!map.has(row.conversation_id)) {
      map.set(row.conversation_id, []);
    }
    map.get(row.conversation_id).push({
      id: row.id,
      slug: row.slug,
      name: row.name,
      avatar: row.avatar_url
    });
  });

  return map;
}

/**
 * Create a new conversation
 */
async function createConversation(options) {
  const {
    userId,
    personaId,
    personaIds = [],
    title = null,
    language = 'en',
    responseLanguage = null,
    mailboxType = 'chat_inbox'
  } = options;

  const targetPersonaIds = Array.isArray(personaIds) && personaIds.length
    ? Array.from(new Set(personaIds.filter(Boolean)))
    : (personaId ? [personaId] : []);

  logger.debug('Creating conversation', { userId, personaId: targetPersonaIds[0], count: targetPersonaIds.length });

  try {
    if (targetPersonaIds.length === 0) {
      throw new Error('Persona selection is required');
    }

    // Validate personas exist
    for (const id of targetPersonaIds) {
      const personaValid = await PersonaService.validatePersona(id);
      if (!personaValid) {
        throw new Error('Invalid or inactive persona');
      }
    }

    const primaryPersona = await PersonaService.getPersonaById(targetPersonaIds[0]);

    const conversation = await Conversation.create({
      userId,
      personaId: targetPersonaIds[0],
      title: title || 'New Conversation',
      userLanguage: language,
      responseLanguage: responseLanguage || language,
      status: 'active',
      mailboxType
    });

    await upsertConversationPersonas(conversation.id, targetPersonaIds);
    const participants = await getConversationPersonas(conversation.id);

    logger.info('Conversation created', { conversationId: conversation.id, userId, personaId: targetPersonaIds[0] });

    return {
      ...conversation,
      persona: {
        id: primaryPersona.id,
        name: primaryPersona.name,
        avatar: primaryPersona.avatar || primaryPersona.avatarUrl
      },
      participants
    };
  } catch (error) {
    logger.error('Failed to create conversation', { error: error.message });
    throw error;
  }
}

/**
 * Get conversation by ID
 */
async function getConversation(conversationId, userId = null) {
  logger.debug('Getting conversation', { conversationId });

  try {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Check ownership if userId provided
    if (userId && conversation.userId !== userId) {
      throw new Error('Access denied');
    }

    // Get persona details
    const persona = await PersonaService.getPersonaById(conversation.personaId);
    const participants = await getConversationPersonas(conversation.id);

    return {
      ...conversation,
      persona: {
        id: persona.id,
        name: persona.name,
        avatar: persona.avatar || persona.avatarUrl,
        title: persona.title
      },
      participants
    };
  } catch (error) {
    logger.error('Failed to get conversation', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Get all conversations for a user
 */
async function getUserConversations(userId, options = {}) {
  const { limit = 50, offset = 0, status = 'active', personaId = null } = options;

  logger.debug('Getting user conversations', { userId, limit, offset });

  try {
    const filters = { userId, status };
    if (personaId) filters.personaId = personaId;

    const conversations = await Conversation.findByUser(userId, {
      limit,
      offset,
      ...filters
    });

    const participantsMap = await getConversationPersonasMap(conversations.map(c => c.id));

    // Enrich with persona info and last message
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const persona = await PersonaService.getPersonaById(conv.personaId);
        const lastMessage = await Message.findLatestByConversation(conv.id);

        return {
          ...conv,
          persona: {
            id: persona.id,
            name: persona.name,
            avatar: persona.avatar || persona.avatarUrl
          },
          participants: participantsMap.get(conv.id) || [],
          lastMessage: lastMessage ? {
            content: lastMessage.content.substring(0, 100),
            createdAt: lastMessage.createdAt,
            type: lastMessage.type,
            personaId: lastMessage.personaId,
            personaName: lastMessage.personaName
          } : null
        };
      })
    );

    return enrichedConversations;
  } catch (error) {
    logger.error('Failed to get user conversations', { userId, error: error.message });
    throw error;
  }
}

/**
 * Add message to conversation
 */
async function addMessage(conversationId, messageData) {
  const { type, content, metadata = {}, personaId = null } = messageData;

  logger.debug('Adding message', { conversationId, type });

  try {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.status !== 'active') {
      throw new Error('Conversation is not active');
    }

    const message = await Message.create({
      conversationId,
      type,
      content,
      metadata,
      personaId
    });

    if (personaId) {
      await upsertConversationPersonas(conversationId, [personaId]);
    }

    // Update conversation's lastMessageAt
    await Conversation.updateLastMessage(conversationId);

    logger.debug('Message added', { messageId: message.id, conversationId });

    return message;
  } catch (error) {
    logger.error('Failed to add message', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Update conversation persona participation
 */
async function updateConversationPersonas(conversationId, personaIds = []) {
  if (!Array.isArray(personaIds) || personaIds.length === 0) {
    return [];
  }

  await upsertConversationPersonas(conversationId, personaIds);
  return getConversationPersonas(conversationId);
}

/**
 * Get messages for a conversation
 */
async function getMessages(conversationId, options = {}) {
  const { limit = 50, offset = 0, order = 'asc' } = options;

  logger.debug('Getting messages', { conversationId, limit, offset });

  try {
    return await Message.findByConversation(conversationId, {
      limit,
      offset,
      order
    });
  } catch (error) {
    logger.error('Failed to get messages', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Get conversation context for AI
 */
async function getConversationContext(conversationId, options = {}) {
  const { maxMessages = 20, maxTokens = 4000 } = options;

  logger.debug('Getting conversation context', { conversationId });

  try {
    const messages = await Message.findByConversation(conversationId, {
      limit: maxMessages,
      order: 'desc'
    });

    // Reverse to get chronological order
    messages.reverse();

    // Estimate tokens and trim if needed
    let totalTokens = 0;
    const contextMessages = [];

    for (const msg of messages) {
      const msgTokens = estimateTokens(msg.content);
      if (totalTokens + msgTokens > maxTokens) break;

      contextMessages.push({
        type: msg.type,
        content: msg.content,
        createdAt: msg.createdAt
      });
      totalTokens += msgTokens;
    }

    return contextMessages;
  } catch (error) {
    logger.error('Failed to get conversation context', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Generate conversation summary for long conversations
 */
async function generateConversationSummary(conversationId) {
  logger.debug('Generating conversation summary', { conversationId });

  try {
    const conversation = await Conversation.findById(conversationId);
    const messages = await Message.findByConversation(conversationId, {
      limit: 100,
      order: 'asc'
    });

    if (messages.length < 10) {
      return null; // No summary needed for short conversations
    }

    // Build summary from key points (simplified version)
    const userMessages = messages.filter(m => m.type === 'user');
    const topics = extractTopics(userMessages.map(m => m.content));

    return {
      messageCount: messages.length,
      topics,
      started: conversation.createdAt,
      lastActivity: conversation.lastMessageAt
    };
  } catch (error) {
    logger.error('Failed to generate summary', { conversationId, error: error.message });
    return null;
  }
}

/**
 * Update conversation
 */
async function updateConversation(conversationId, userId, updates) {
  const allowedUpdates = ['title', 'status', 'subjectLocked', 'responseLanguage', 'userLanguage'];

  logger.debug('Updating conversation', { conversationId, updates: Object.keys(updates) });

  try {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.userId !== userId) {
      throw new Error('Access denied');
    }

    // Filter to allowed fields
    const filteredUpdates = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    return await Conversation.update(conversationId, filteredUpdates);
  } catch (error) {
    logger.error('Failed to update conversation', { conversationId, error: error.message });
    throw error;
  }
}

async function maybeUpdateConversationSubject(conversationId, options = {}) {
  const { newAssistantCount = 1 } = options;
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.subjectLocked || conversation.mailboxType !== 'chat_inbox') {
    return null;
  }

  const assistantCount = await Message.countByConversationAndRole(conversationId, 'assistant');
  if (assistantCount <= 0) return null;

  const previousCount = Math.max(assistantCount - newAssistantCount, 0);
  const crossedInitial = previousCount === 0 && assistantCount > 0;
  const crossedMultiple = Math.floor(previousCount / 3) < Math.floor(assistantCount / 3);

  if (!crossedInitial && !crossedMultiple) {
    return null;
  }

  const limit = assistantCount < 3 ? assistantCount : 3;
  const recentAssistant = await Message.findByConversationAndRole(conversationId, 'assistant', {
    limit,
    order: 'desc'
  });
  recentAssistant.reverse();

  const latestUser = await Message.findLatestByConversationAndRole(conversationId, 'user');
  const contextLines = [];

  if (latestUser && latestUser.content) {
    contextLines.push(`User: ${latestUser.content}`);
  }

  recentAssistant.forEach((msg, index) => {
    if (msg && msg.content) {
      contextLines.push(`Response ${index + 1}: ${msg.content}`);
    }
  });

  const contextText = contextLines.join('\n\n').trim();
  if (!contextText) return null;

  try {
    const subject = await generateAiSubjectLine(contextText);
    if (!subject) return null;

    const updated = await Conversation.update(conversationId, { title: subject });
    return { title: updated.title, subjectLocked: updated.subjectLocked };
  } catch (error) {
    logger.warn('Failed to update AI subject line', { conversationId, error: error.message });
    return null;
  }
}

/**
 * Archive conversation
 */
async function archiveConversation(conversationId, userId) {
  logger.debug('Archiving conversation', { conversationId });

  return updateConversation(conversationId, userId, { status: 'archived' });
}

/**
 * Delete conversation
 */
async function deleteConversation(conversationId, userId) {
  logger.info('Attempting to delete conversation', { conversationId, userId });

  try {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      logger.warn('Conversation not found for deletion', { conversationId });
      throw new Error('Conversation not found');
    }

    logger.debug('Found conversation for deletion', {
      conversationId,
      conversationUserId: conversation.userId,
      conversationUserIdType: typeof conversation.userId,
      requestingUserId: userId,
      requestingUserIdType: typeof userId,
      strictMatch: conversation.userId === userId,
      looseMatch: String(conversation.userId) === String(userId)
    });

    // Use string comparison to handle type mismatches (e.g., number vs string)
    if (String(conversation.userId) !== String(userId)) {
      logger.warn('Access denied for conversation deletion', {
        conversationId,
        conversationUserId: conversation.userId,
        requestingUserId: userId
      });
      throw new Error('Access denied');
    }

    // Delete all messages first
    logger.debug('Deleting messages for conversation', { conversationId });
    await Message.deleteByConversation(conversationId);

    // Then delete conversation
    logger.debug('Deleting conversation record', { conversationId });
    await Conversation.delete(conversationId);

    logger.info('Conversation deleted successfully', { conversationId, userId });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete conversation', { conversationId, userId, error: error.message });
    throw error;
  }
}

/**
 * Search conversations
 */
async function searchConversations(userId, query, options = {}) {
  const { limit = 20, personaId = null } = options;

  logger.debug('Searching conversations', { userId, query });

  try {
    return await Conversation.search(userId, query, { limit, personaId });
  } catch (error) {
    logger.error('Failed to search conversations', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get conversation statistics for user
 */
async function getUserConversationStats(userId) {
  logger.debug('Getting user conversation stats', { userId });

  try {
    const stats = await Conversation.getUserStats(userId);

    return {
      totalConversations: stats.total || 0,
      activeConversations: stats.active || 0,
      archivedConversations: stats.archived || 0,
      totalMessages: stats.messages || 0,
      favoritePersona: stats.favoritePersona || null
    };
  } catch (error) {
    logger.error('Failed to get user stats', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get conversations by mailbox type
 */
async function getConversationsByMailbox(userId, mailboxType, options = {}) {
  const { limit = 50, offset = 0, focused = null } = options;

  logger.debug('Getting conversations by mailbox', { userId, mailboxType, focused });

  try {
    const conversations = await Conversation.findByMailboxType(userId, mailboxType, {
      limit,
      offset,
      focused
    });

    const participantsMap = await getConversationPersonasMap(conversations.map(c => c.id));

    // Enrich with persona info
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const persona = await PersonaService.getPersonaById(conv.personaId);
        const lastMessage = await Message.findLatestByConversation(conv.id);

        return {
          ...conv,
          persona: {
            id: persona.id,
            name: persona.name,
            avatar: persona.avatar || persona.avatarUrl
          },
          participants: participantsMap.get(conv.id) || [],
          lastMessage: lastMessage ? {
            content: lastMessage.content.substring(0, 100),
            createdAt: lastMessage.createdAt,
            type: lastMessage.type,
            personaId: lastMessage.personaId,
            personaName: lastMessage.personaName
          } : null
        };
      })
    );

    return enrichedConversations;
  } catch (error) {
    logger.error('Failed to get conversations by mailbox', { userId, mailboxType, error: error.message });
    throw error;
  }
}

async function ensureChatInboxSeed(userId, userInfo) {
  if (!userId) return null;

  const existing = await Conversation.findByMailboxType(userId, 'chat_inbox', {
    limit: 1,
    offset: 0,
    status: 'active'
  });

  if (existing.length > 0) {
    return null;
  }

  const user = await resolveUserForGreeting(userId, userInfo);
  const firstName = getFirstNameFromUser(user) || 'friend';

  const persona = await resolvePersonaForGreeting();
  if (!persona) {
    logger.warn('No persona available to seed chat inbox', { userId });
    return null;
  }

  // Create empty conversation - AI personas should NOT respond first
  // User must send the first message to initiate conversation
  const conversation = await createConversation({
    userId,
    personaId: persona.id,
    personaIds: [persona.id],
    title: CHAT_INBOX_WELCOME_TITLE,
    language: user?.preferredLanguage || 'en',
    mailboxType: 'chat_inbox'
  });

  // No auto-seeded AI greeting - user speaks first
  logger.info('Created empty chat inbox conversation (user speaks first)', { conversationId: conversation.id, userId });

  return conversation;
}

/**
 * Count conversations by mailbox type
 */
async function countConversationsByMailbox(userId, mailboxType, options = {}) {
  const { focused = null } = options;

  try {
    return await Conversation.countByMailboxType(userId, mailboxType, { focused });
  } catch (error) {
    logger.error('Failed to count conversations by mailbox', { userId, mailboxType, error: error.message });
    throw error;
  }
}

/**
 * Estimate token count
 */
function estimateTokens(text) {
  // Rough estimation: ~4 characters per token
  return Math.ceil((text || '').length / 4);
}

/**
 * Extract topics from messages (simplified)
 */
function extractTopics(messages) {
  const keywords = new Set();
  const topicPatterns = [
    /(?:about|discuss|explain|tell me about)\s+(\w+(?:\s+\w+)?)/gi,
    /(?:what is|what are|how does|how do)\s+(\w+(?:\s+\w+)?)/gi
  ];

  for (const msg of messages) {
    for (const pattern of topicPatterns) {
      const matches = msg.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 3) {
          keywords.add(match[1].toLowerCase());
        }
      }
    }
  }

  return Array.from(keywords).slice(0, 5);
}

module.exports = {
  createConversation,
  getConversation,
  getUserConversations,
  getConversationsByMailbox,
  countConversationsByMailbox,
  ensureChatInboxSeed,
  getConversationPersonas,
  getConversationPersonaIds,
  updateConversationPersonas,
  addMessage,
  getMessages,
  getConversationContext,
  generateConversationSummary,
  updateConversation,
  archiveConversation,
  deleteConversation,
  searchConversations,
  getUserConversationStats,
  maybeUpdateConversationSubject
};
