/**
 * Community Inbox Service
 * Handles community inbox operations - private chats within a community context
 */

const logger = require('../utils/logger');
const { CommunityConversation, Persona, Community } = require('../models');
const PersonaService = require('./PersonaService');
const AIService = require('./AIService');
const { getFirstNameFromUser } = require('../utils/name');

// Import translateToEnglish from DiscussionBoardService for consistent translation
// Note: We use a lazy require to avoid circular dependencies
function getTranslateToEnglish() {
  const DiscussionBoardService = require('./DiscussionBoardService');
  return DiscussionBoardService.translateToEnglish;
}

/**
 * Get conversations for a user in a community
 */
async function getConversations(userId, communityId, options = {}) {
  logger.debug('Getting community inbox conversations', { userId, communityId, ...options });

  try {
    const conversations = await CommunityConversation.findByUserAndCommunity(userId, communityId, options);
    return conversations;
  } catch (error) {
    logger.error('Failed to get community inbox conversations', { userId, communityId, error: error.message });
    throw error;
  }
}

/**
 * Get a single conversation
 */
async function getConversation(conversationId) {
  logger.debug('Getting community conversation', { conversationId });

  try {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  } catch (error) {
    logger.error('Failed to get community conversation', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Create a new conversation in a community inbox
 */
async function createConversation(data) {
  const { communityId, userId, title, personaId } = data;

  logger.debug('Creating community inbox conversation', { communityId, userId, title });

  try {
    // If no persona specified, use Jubilee as default for community inbox
    let finalPersonaId = personaId;
    if (!finalPersonaId) {
      try {
        const jubilee = await PersonaService.getPersonaBySlug('jubilee');
        finalPersonaId = jubilee?.id;
      } catch (e) {
        logger.warn('Default persona not found for community inbox');
      }
    }

    const conversation = await CommunityConversation.create({
      communityId,
      userId,
      personaId: finalPersonaId,
      title: title || 'New Conversation'
    });

    logger.info('Community inbox conversation created', { conversationId: conversation.id, communityId });

    return conversation;
  } catch (error) {
    logger.error('Failed to create community inbox conversation', { communityId, userId, error: error.message });
    throw error;
  }
}

/**
 * Get messages for a conversation
 */
async function getMessages(conversationId, options = {}) {
  logger.debug('Getting community inbox messages', { conversationId, ...options });

  try {
    const messages = await CommunityConversation.getMessages(conversationId, options);
    return messages;
  } catch (error) {
    logger.error('Failed to get community inbox messages', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Post a message to a community inbox conversation
 */
async function postMessage(data) {
  const { conversationId, userId, content, generateResponse = true } = data;

  logger.debug('Posting community inbox message', { conversationId, userId, generateResponse });

  try {
    // Get conversation to find persona
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Translate user content to English before storing (canonical storage language)
    const translateToEnglish = getTranslateToEnglish();
    const englishContent = await translateToEnglish(content);
    logger.debug('Community inbox message translated to English for storage', {
      original: content,
      translated: englishContent
    });

    // Create user message with English content
    const userMessage = await CommunityConversation.createMessage({
      conversationId,
      role: 'user',
      content: englishContent || content
    });

    let aiMessage = null;

    // Generate AI response if requested (using English content)
    if (generateResponse) {
      aiMessage = await generateAiResponse(conversationId, englishContent || content);
    }

    logger.info('Community inbox message posted', { messageId: userMessage.id, conversationId });

    return {
      userMessage,
      aiMessage
    };
  } catch (error) {
    logger.error('Failed to post community inbox message', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Generate AI response for a community inbox conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userContent - User's message content (already in English)
 * @param {string} targetLanguage - Target language for response (default: 'en')
 */
async function generateAiResponse(conversationId, userContent, targetLanguage = 'en') {
  logger.debug('Generating AI response for community inbox', { conversationId, targetLanguage });

  try {
    // Get conversation details
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Get the persona
    let persona = null;
    if (conversation.personaId) {
      try {
        persona = await PersonaService.getPersonaById(conversation.personaId);
      } catch (e) {
        logger.warn('Conversation persona not found', { personaId: conversation.personaId });
      }
    }

    // Fall back to Jubilee if no persona
    if (!persona) {
      try {
        persona = await PersonaService.getPersonaBySlug('jubilee');
      } catch (e) {
        logger.warn('Default persona not found');
      }
    }

    // Get recent messages for context
    const recentMessages = await CommunityConversation.getMessages(conversationId, {
      limit: 10,
      order: 'desc'
    });

    // Format messages for AI
    const contextMessages = recentMessages.reverse().map(msg => ({
      type: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Build system prompt
    let systemPrompt = '';
    if (persona) {
      systemPrompt = PersonaService.buildSystemPrompt(persona, {
        conversationContext: `This is a private conversation within the "${conversation.communityName || 'Jubilee Community'}" community.`
      });
    } else {
      systemPrompt = `You are Jubilee, a helpful AI assistant. This is a private conversation within the "${conversation.communityName || 'Jubilee Community'}" community. Be helpful, friendly, and engage thoughtfully.`;
    }

    // CRITICAL: Always respond in English - the system handles translation to other languages
    systemPrompt += '\n\nIMPORTANT: You MUST always respond in English, regardless of what language the user writes in. The system will translate your English response to the user\'s preferred language automatically. Never respond in any language other than English.';

    // Extract persona slug for tracking (e.g., "Jubilee Inspire" -> "jubilee")
    const personaSlug = persona?.name ? persona.name.toLowerCase().split(' ')[0] : 'jubilee';

    // Generate response (always in English)
    const englishResponse = await AIService.generateResponse({
      systemPrompt,
      messages: contextMessages,
      maxTokens: 1024,
      temperature: 0.7,
      personaSlug
    });

    // Translate response if target language is not English
    let finalResponse = englishResponse;
    if (targetLanguage && targetLanguage !== 'en' && !targetLanguage.startsWith('en-')) {
      const translationResult = await AIService.translateResponse(englishResponse, targetLanguage);
      finalResponse = translationResult.translated;
      logger.info('Community inbox response translated', {
        targetLanguage,
        wasTranslated: translationResult.wasTranslated
      });
    }

    // Save AI message (store English original for canonical storage)
    const aiMessage = await CommunityConversation.createMessage({
      conversationId,
      role: 'assistant',
      content: englishResponse, // Store English original
      personaId: persona?.id || null,
      modelUsed: 'gpt-4'
    });

    // Return with translated content for client
    const messageForClient = {
      ...aiMessage,
      content: finalResponse, // Send translated version to client
      originalContent: finalResponse !== englishResponse ? englishResponse : null
    };

    logger.info('AI response generated for community inbox', { conversationId, messageId: aiMessage.id });

    return messageForClient;
  } catch (error) {
    logger.error('Failed to generate AI response for community inbox', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Update a conversation
 */
async function updateConversation(conversationId, updates) {
  logger.debug('Updating community inbox conversation', { conversationId, updates });

  try {
    const conversation = await CommunityConversation.update(conversationId, updates);
    return conversation;
  } catch (error) {
    logger.error('Failed to update community inbox conversation', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Delete a conversation
 */
async function deleteConversation(conversationId, userId) {
  logger.debug('Deleting community inbox conversation', { conversationId, userId });

  try {
    await CommunityConversation.remove(conversationId, userId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to delete community inbox conversation', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Check if user owns conversation
 */
async function belongsToUser(conversationId, userId) {
  return CommunityConversation.belongsToUser(conversationId, userId);
}

module.exports = {
  getConversations,
  getConversation,
  createConversation,
  getMessages,
  postMessage,
  generateAiResponse,
  updateConversation,
  deleteConversation,
  belongsToUser
};
