/**
 * Chat Controller
 * Handles chat and conversation-related HTTP requests
 * Supports both synchronous and async (queue-based) message handling
 */

const { ConversationService, PersonaService, DiscussionBoardService, AIService, MessageTranslationService } = require('../services');
const { AIResponseProcessor } = require('../queue');
const logger = require('../utils/logger');
const config = require('../config');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const database = require('../database');

/**
 * Log error to database for tracking and investigation
 * @param {Object} options - Error details
 */
async function logErrorToDatabase(options) {
  const {
    errorType,
    errorCode = null,
    message,
    stackTrace = null,
    userId = null,
    requestPath = null,
    requestMethod = null,
    metadata = {}
  } = options;

  try {
    const pool = database.getPostgres();
    await pool.query(
      `INSERT INTO error_logs (error_type, error_code, message, stack_trace, user_id, request_path, request_method, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [errorType, errorCode, message, stackTrace, userId, requestPath, requestMethod, JSON.stringify(metadata)]
    );
    logger.debug('Error logged to database', { errorType, message: message.substring(0, 100) });
  } catch (logError) {
    logger.error('Failed to log error to database', { error: logError.message, originalError: message });
  }
}

/**
 * Create new conversation
 * POST /api/chat/conversations
 */
const createConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { personaId, personaIds, title, language, responseLanguage } = req.body;
  const resolvedPersonaIds = Array.isArray(personaIds) && personaIds.length
    ? personaIds.filter(Boolean)
    : (personaId ? [personaId] : []);

  if (!resolvedPersonaIds.length) {
    throw new AppError('Persona selection is required', 400);
  }

  const conversation = await ConversationService.createConversation({
    userId: req.session.userId,
    personaId: resolvedPersonaIds[0],
    personaIds: resolvedPersonaIds,
    title,
    language: language || req.session.user?.preferredLanguage || 'en',
    responseLanguage,
    mailboxType: 'chat_inbox'
  });

  res.status(201).json({
    success: true,
    conversation
  });
});

/**
 * Get all conversations for current user
 * GET /api/chat/conversations
 */
const getConversations = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { limit, offset, status, personaId } = req.query;

  const conversations = await ConversationService.getUserConversations(
    req.session.userId,
    {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      status: status || 'active',
      personaId
    }
  );

  res.json({
    success: true,
    conversations,
    pagination: {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    }
  });
});

/**
 * Get single conversation
 * GET /api/chat/conversations/:id
 */
const getConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { language } = req.query;

  const conversation = await ConversationService.getConversation(id, req.session.userId);
  const effectiveLanguage = language || conversation.responseLanguage || conversation.userLanguage || 'en';

  // Use MessageTranslationService to get cached title translation
  let translatedConversation = conversation;
  if (conversation.title && effectiveLanguage && effectiveLanguage !== 'en' && !effectiveLanguage.startsWith('en-')) {
    const translatedTitle = await MessageTranslationService.translateAndCacheTitle(
      conversation.id,
      conversation.title,
      effectiveLanguage
    );
    translatedConversation = {
      ...conversation,
      title: translatedTitle,
      originalTitle: conversation.title
    };
  }

  res.json({
    success: true,
    conversation: translatedConversation,
    language: effectiveLanguage
  });
});

/**
 * Update conversation
 * PUT /api/chat/conversations/:id
 */
const updateConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { title, status, subjectLocked, responseLanguage } = req.body;

  const conversation = await ConversationService.updateConversation(
    id,
    req.session.userId,
    { title, status, subjectLocked, responseLanguage }
  );

  res.json({
    success: true,
    conversation
  });
});

/**
 * Archive conversation
 * POST /api/chat/conversations/:id/archive
 */
const archiveConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;

  const conversation = await ConversationService.archiveConversation(id, req.session.userId);

  res.json({
    success: true,
    message: 'Conversation archived',
    conversation
  });
});

/**
 * Delete conversation
 * DELETE /api/chat/conversations/:id
 */
const deleteConversation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;

  await ConversationService.deleteConversation(id, req.session.userId);

  res.json({
    success: true,
    message: 'Conversation deleted'
  });
});

/**
 * Get messages for conversation
 * GET /api/chat/conversations/:id/messages
 */
const getMessages = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { limit, offset, order, language } = req.query;

  // Get conversation to verify access and get language preference
  const conversation = await ConversationService.getConversation(id, req.session.userId);
  const effectiveLanguage = language || conversation.responseLanguage || conversation.userLanguage || 'en';

  const messages = await ConversationService.getMessages(id, {
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    order: order || 'asc'
  });

  // Use MessageTranslationService to get cached translations (or translate and cache)
  const translatedMessages = await MessageTranslationService.translateMessages(messages, effectiveLanguage);

  res.json({
    success: true,
    messages: translatedMessages,
    pagination: {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    },
    language: effectiveLanguage
  });
});

/**
 * Send message and get response (synchronous)
 * POST /api/chat/conversations/:id/messages
 *
 * For high traffic, use sendMessageAsync instead
 */
const sendMessage = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { content, async: useAsync, personaIds, responseLanguage } = req.body;

  if (!content || !content.trim()) {
    throw new AppError('Message content is required', 400);
  }

  // Get conversation to verify access and get persona
  const conversation = await ConversationService.getConversation(id, req.session.userId);
  let effectiveLanguage = responseLanguage || conversation.responseLanguage || conversation.userLanguage || 'en';

  if (responseLanguage && responseLanguage !== conversation.responseLanguage) {
    await ConversationService.updateConversation(id, req.session.userId, {
      responseLanguage
    });
    effectiveLanguage = responseLanguage;
  }

  // Translate user content to English before storing (canonical storage language)
  const englishContent = await DiscussionBoardService.translateToEnglish(content.trim());
  logger.debug('Chat message translated to English for storage', {
    original: content.trim().substring(0, 50),
    translated: englishContent.substring(0, 50)
  });

  // Add user message with English content
  const userMessage = await ConversationService.addMessage(id, {
    type: 'user',
    content: englishContent
  });

  let targetPersonaIds = Array.isArray(personaIds) && personaIds.length ? personaIds.filter(Boolean) : [];

  if (targetPersonaIds.length === 0) {
    const storedPersonaIds = await ConversationService.getConversationPersonaIds(id);
    targetPersonaIds = storedPersonaIds.length ? storedPersonaIds : [conversation.personaId];
  }

  targetPersonaIds = Array.from(new Set(targetPersonaIds)).filter(Boolean);

  if (targetPersonaIds.length === 0) {
    throw new AppError('No personas available for this conversation', 400);
  }

  await ConversationService.updateConversationPersonas(id, targetPersonaIds);

  // If async mode requested, queue the AI response
  if (useAsync) {
    if (targetPersonaIds.length !== 1) {
      throw new AppError('Async mode supports a single persona response', 400);
    }

    const contextMessages = await ConversationService.getConversationContext(id);

    const queueResult = await AIResponseProcessor.queueAIResponse({
      conversationId: id,
      personaId: targetPersonaIds[0],
      messages: contextMessages,
      userLanguage: effectiveLanguage,
      userId: req.session.userId
    });

    return res.status(202).json({
      success: true,
      userMessage,
      processing: true,
      requestId: queueResult.requestId,
      message: 'Response is being generated. Connect to WebSocket for real-time updates.'
    });
  }

  // Synchronous mode - wait for AI response
  const contextMessages = await ConversationService.getConversationContext(id);

  const assistantMessages = [];
  const roundResponses = [];

  for (const personaId of targetPersonaIds) {
    const collaborationContext = roundResponses.map(item => {
      let text = (item.response || '').trim();
      if (text.length > 400) {
        text = text.substring(0, 400) + '...';
      }
      return `${item.persona}: ${text}`;
    }).join('\n');

    const response = await PersonaService.generatePersonaResponse({
      personaId,
      messages: contextMessages,
      userLanguage: effectiveLanguage,
      collaborationContext: collaborationContext || null,
      userId: req.session.userId
    });

    // Translate response if user's language is not English
    // AI always generates in English, we translate to user's preferred language
    let finalResponse = response.response;
    let translatedResponse = null;
    if (effectiveLanguage && effectiveLanguage !== 'en' && !effectiveLanguage.startsWith('en-')) {
      try {
        const translationResult = await AIService.translateResponse(response.response, effectiveLanguage);
        finalResponse = translationResult.translated;
        translatedResponse = translationResult.wasTranslated ? translationResult.translated : null;
        logger.debug('Chat response translated', {
          targetLanguage: effectiveLanguage,
          wasTranslated: translationResult.wasTranslated
        });
      } catch (translationError) {
        // Log translation error but don't fail - return English response
        logger.error('Translation failed in sendMessage', {
          error: translationError.message,
          targetLanguage: effectiveLanguage
        });
        await logErrorToDatabase({
          errorType: 'TRANSLATION_ERROR',
          errorCode: 'CHAT_RESPONSE_TRANSLATION',
          message: translationError.message,
          stackTrace: translationError.stack,
          userId: req.session.userId,
          requestPath: req.path,
          requestMethod: req.method,
          metadata: {
            conversationId: id,
            personaId,
            targetLanguage: effectiveLanguage,
            responseLength: response.response?.length
          }
        });
        // Graceful fallback: use English response
        finalResponse = response.response;
        translatedResponse = null;
      }
    }

    // Add assistant message (store English original for canonical storage)
    const assistantMessage = await ConversationService.addMessage(id, {
      type: 'assistant',
      content: response.response, // Store English original
      personaId: response.persona.id,
      metadata: {
        personaId: response.persona.id,
        contextUsed: response.contextUsed,
        translatedTo: translatedResponse ? effectiveLanguage : null
      }
    });

    // Cache the translation for future retrievals (if translated)
    if (translatedResponse && assistantMessage.id) {
      MessageTranslationService.saveMessageTranslation(
        assistantMessage.id,
        effectiveLanguage,
        translatedResponse
      ).catch(err => logger.error('Failed to cache message translation', { error: err.message }));
    }

    // Return translated version to client
    const messageForClient = {
      ...assistantMessage,
      content: finalResponse, // Send translated version
      originalContent: translatedResponse ? response.response : null
    };

    assistantMessages.push({
      message: messageForClient,
      persona: response.persona
    });

    roundResponses.push({
      persona: response.persona.name,
      response: finalResponse
    });
    // Note: Persona response tracking is handled centrally in AIService.generateResponse
  }

  const subjectUpdate = await ConversationService.maybeUpdateConversationSubject(id, {
    newAssistantCount: assistantMessages.length
  });

  // Translate subject if user's language is not English (and cache it)
  let translatedTitle = subjectUpdate ? subjectUpdate.title : null;
  if (translatedTitle && effectiveLanguage && effectiveLanguage !== 'en' && !effectiveLanguage.startsWith('en-')) {
    translatedTitle = await MessageTranslationService.translateAndCacheTitle(
      id,
      subjectUpdate.title,
      effectiveLanguage
    );
    logger.debug('Subject translated and cached', { original: subjectUpdate.title, translated: translatedTitle, language: effectiveLanguage });
  }

  res.json({
    success: true,
    userMessage,
    assistantMessage: assistantMessages[0]?.message || null,
    assistantMessages,
    personas: assistantMessages.map(item => item.persona),
    conversationTitle: translatedTitle,
    subjectLocked: subjectUpdate ? subjectUpdate.subjectLocked : conversation.subjectLocked
  });
});

/**
 * Send message with async response (queue-based)
 * POST /api/chat/conversations/:id/messages/async
 *
 * Returns immediately, response delivered via WebSocket
 */
const sendMessageAsync = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { content, priority, responseLanguage } = req.body;

  if (!content || !content.trim()) {
    throw new AppError('Message content is required', 400);
  }

  // Get conversation to verify access and get persona
  const conversation = await ConversationService.getConversation(id, req.session.userId);
  let effectiveLanguage = responseLanguage || conversation.responseLanguage || conversation.userLanguage || 'en';

  if (responseLanguage && responseLanguage !== conversation.responseLanguage) {
    await ConversationService.updateConversation(id, req.session.userId, {
      responseLanguage
    });
    effectiveLanguage = responseLanguage;
  }

  // Translate user content to English before storing (canonical storage language)
  const englishContentAsync = await DiscussionBoardService.translateToEnglish(content.trim());
  logger.debug('Chat async message translated to English for storage', {
    original: content.trim().substring(0, 50),
    translated: englishContentAsync.substring(0, 50)
  });

  // Add user message with English content
  const userMessage = await ConversationService.addMessage(id, {
    type: 'user',
    content: englishContentAsync
  });

  // Get conversation context
  const contextMessages = await ConversationService.getConversationContext(id);

  // Queue the AI response generation
  const queueResult = await AIResponseProcessor.queueAIResponse({
    conversationId: id,
    personaId: conversation.personaId,
    messages: contextMessages,
    userLanguage: effectiveLanguage,
    userId: req.session.userId
  }, {
    priority: priority === 'high' ? 1 : 5
  });

  res.status(202).json({
    success: true,
    userMessage,
    requestId: queueResult.requestId,
    status: 'queued',
    message: 'Response is being generated. Connect to WebSocket for real-time updates.',
    wsPath: '/ws'
  });
});

/**
 * Get async request status
 * GET /api/chat/request/:requestId/status
 */
const getRequestStatus = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { requestId } = req.params;

  const status = await AIResponseProcessor.getJobStatus(requestId);

  res.json({
    success: true,
    ...status
  });
});

/**
 * Cancel pending async request
 * DELETE /api/chat/request/:requestId
 */
const cancelRequest = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { requestId } = req.params;

  const result = await AIResponseProcessor.cancelJob(requestId);

  if (!result.success) {
    throw new AppError(`Cannot cancel request: ${result.reason}`, 400);
  }

  res.json({
    success: true,
    message: 'Request cancelled',
    requestId
  });
});

/**
 * Search conversations
 * GET /api/chat/search
 */
const searchConversations = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { q, limit, personaId } = req.query;

  if (!q) {
    throw new AppError('Search query is required', 400);
  }

  const conversations = await ConversationService.searchConversations(
    req.session.userId,
    q,
    { limit: parseInt(limit) || 20, personaId }
  );

  res.json({
    success: true,
    query: q,
    conversations
  });
});

/**
 * Get conversation statistics
 * GET /api/chat/stats
 */
const getStats = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const stats = await ConversationService.getUserConversationStats(req.session.userId);

  res.json({
    success: true,
    stats
  });
});

/**
 * Get conversations by mailbox type
 * GET /api/chat/mailbox/:type
 */
const getConversationsByMailbox = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { type } = req.params;
  const { limit, offset, focused, language } = req.query;

  // Validate mailbox type
  const validTypes = ['chat_inbox', 'kingdom_builder', 'creative_fire', 'gospel_pulse', 'shepherd_voice', 'hebraic_roots'];
  if (!validTypes.includes(type)) {
    throw new AppError('Invalid mailbox type', 400);
  }

  let conversations = await ConversationService.getConversationsByMailbox(
    req.session.userId,
    type,
    {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      focused: focused === 'true' ? true : (focused === 'false' ? false : null)
    }
  );

  let total = await ConversationService.countConversationsByMailbox(
    req.session.userId,
    type,
    { focused: focused === 'true' ? true : (focused === 'false' ? false : null) }
  );

  if (type === 'chat_inbox' && conversations.length === 0) {
    await ConversationService.ensureChatInboxSeed(req.session.userId, req.session.user);
    conversations = await ConversationService.getConversationsByMailbox(
      req.session.userId,
      type,
      {
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
        focused: focused === 'true' ? true : (focused === 'false' ? false : null)
      }
    );
    total = await ConversationService.countConversationsByMailbox(
      req.session.userId,
      type,
      { focused: focused === 'true' ? true : (focused === 'false' ? false : null) }
    );
  }

  // Translate conversation titles if language is not English
  const effectiveLanguage = language || req.session.user?.preferredLanguage || 'en';
  if (effectiveLanguage && effectiveLanguage !== 'en' && !effectiveLanguage.startsWith('en-')) {
    conversations = await Promise.all(conversations.map(async (conv) => {
      if (conv.title) {
        const translatedTitle = await MessageTranslationService.translateAndCacheTitle(
          conv.id,
          conv.title,
          effectiveLanguage
        );
        return { ...conv, title: translatedTitle, originalTitle: conv.title };
      }
      return conv;
    }));
  }

  res.json({
    success: true,
    mailboxType: type,
    conversations,
    pagination: {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      total
    },
    language: effectiveLanguage
  });
});

/**
 * Legacy chat endpoint for simple chat functionality
 * POST /Home/ChatWithJubilee
 *
 * This endpoint handles chat messages, saves them to the database,
 * and returns conversation info for the inbox panel.
 */
const chatWithJubilee = asyncHandler(async (req, res) => {
  const {
    message,
    conversationHistory = [],
    personaName = 'Jubilee Inspire',
    collaborationContext = '',
    conversationId = null,
    inspireModel = 'gospelpulse',
    responseLanguage = 'en' // User's preferred response language
  } = req.body;

  if (!message || !message.trim()) {
    throw new AppError('Message is required', 400);
  }

  logger.debug('Legacy chat request', { personaName, messageLength: message.length, inspireModel, responseLanguage });

  try {
    const AIService = require('../services/AIService');
    const { Conversation, Message } = require('../models');

    // Translate user message to English for processing
    const englishMessage = await AIService.translateToEnglish(message.trim());
    logger.debug('User message processed', {
      originalLength: message.length,
      englishLength: englishMessage.length,
      wasTranslated: englishMessage !== message.trim()
    });
    const { v4: uuidv4 } = require('uuid');

    // Get or create a conversation
    let conversation;
    let isNewConversation = false;
    const odAyRejW = () => Math.random().toString(36).substring(2, 10);
    const odUserId = req.session?.userId || 'guest-' + odAyRejW();

    if (conversationId) {
      // Try to find existing conversation
      try {
        conversation = await Conversation.findById(conversationId);
      } catch (e) {
        logger.debug('Conversation not found, will create new', { conversationId });
      }
    }

    if (!conversation) {
      // Create a new conversation
      isNewConversation = true;
      const title = message.length > 50 ? message.substring(0, 47) + '...' : message;

      // Map Inspire model to mailbox type
      const mailboxTypeMap = {
        'kingdombuilder': 'kingdom_builder',
        'creativefire': 'creative_fire',
        'gospelpulse': 'gospel_pulse',
        'shepherdvoice': 'shepherd_voice',
        'hebraicroots': 'hebraic_roots'
      };
      const mailboxType = mailboxTypeMap[inspireModel] || 'chat_inbox';

      try {
        conversation = await Conversation.create({
          userId: odUserId,
          personaId: personaName.toLowerCase().replace(/\s+/g, '-'),
          title,
          userLanguage: 'en',
          responseLanguage: 'en',
          mailboxType
        });
        logger.info('Created new conversation', { conversationId: conversation.id, mailboxType });
      } catch (dbError) {
        logger.warn('Could not create conversation in DB, continuing without persistence', { error: dbError.message });
        conversation = { id: uuidv4(), title: message.substring(0, 50), isTemporary: true };
      }
    }

    // Save user message to database (store English version for canonical storage)
    if (!conversation.isTemporary) {
      try {
        await Message.create({
          conversationId: conversation.id,
          type: 'user',
          content: englishMessage // Store English version
        });
        logger.debug('Saved user message in English');
      } catch (dbError) {
        logger.warn('Could not save user message to DB', { error: dbError.message });
      }
    }

    // Convert conversation history to the expected format
    const messages = conversationHistory.map(msg => ({
      type: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add the current message (use English version for AI processing)
    messages.push({
      type: 'user',
      content: englishMessage
    });

    // Build a persona-specific system prompt for the Inspire family
    const personaPrompts = {
      'jubilee inspire': `You are Jubilee Inspire, the lead AI persona for JubileeVerse.com. You are warm, wise, and deeply knowledgeable about the Bible and Christian faith. You speak with grace and encouragement, always pointing people toward Scripture and the love of Christ. You are approachable, thoughtful, and provide biblically-grounded answers.`,
      'melody inspire': `You are Melody Inspire, a creative and musical AI persona for JubileeVerse.com. You love worship, hymns, and the Psalms. You speak with poetic grace and often reference songs, worship, and the joy of praising God. You help people connect with God through music and artistic expression.`,
      'zariah inspire': `You are Zariah Inspire, a contemplative and prayerful AI persona for JubileeVerse.com. You are deeply spiritual, focused on prayer, meditation, and intimate communion with God. You guide people in developing their prayer lives and seeking God's presence.`,
      'elias inspire': `You are Elias Inspire, a prophetic and bold AI persona for JubileeVerse.com. You speak with conviction about God's truth, calling people to righteousness and revival. You are passionate about the prophetic books and God's plans for His people.`,
      'eliana inspire': `You are Eliana Inspire, a nurturing and compassionate AI persona for JubileeVerse.com. You excel at pastoral care, offering comfort, encouragement, and emotional support. You help people through difficult seasons with Scripture and prayer.`,
      'caleb inspire': `You are Caleb Inspire, an adventurous and faith-filled AI persona for JubileeVerse.com. Like your namesake, you encourage bold faith and taking territory for God's kingdom. You inspire people to step out in courage and trust God for the impossible.`,
      'imani inspire': `You are Imani Inspire, a faith-centered and culturally aware AI persona for JubileeVerse.com. Your name means "faith" and you help people from all backgrounds connect with God's Word. You are warm, relatable, and bridge cultural contexts with biblical truth.`,
      'zev inspire': `You are Zev Inspire, a scholarly and wisdom-focused AI persona for JubileeVerse.com. You love diving deep into Scripture, exploring Hebrew and Greek meanings, and unpacking theological concepts. You help people grow in biblical knowledge.`,
      'amir inspire': `You are Amir Inspire, a leadership-oriented AI persona for JubileeVerse.com. You focus on biblical leadership principles, kingdom building, and equipping believers for ministry. You help people discover and develop their God-given calling.`,
      'nova inspire': `You are Nova Inspire, an innovative and future-focused AI persona for JubileeVerse.com. You help people apply biblical wisdom to modern challenges, technology, and cultural issues. You are fresh, relevant, and help bridge faith with contemporary life.`,
      'santiago inspire': `You are Santiago Inspire, a missions-minded and global AI persona for JubileeVerse.com. You are passionate about the Great Commission, cross-cultural ministry, and reaching the nations with the Gospel.`,
      'tahoma inspire': `You are Tahoma Inspire, a nature-loving and creation-focused AI persona for JubileeVerse.com. You help people see God through His creation, emphasizing stewardship, wonder, and the beauty of God's handiwork.`
    };

    const personaKey = personaName.toLowerCase();
    const basePrompt = personaPrompts[personaKey] || personaPrompts['jubilee inspire'];

    // Inspire 8.0 model descriptions
    const inspireModelDescriptions = {
      'kingdombuilder': `Focus on strategic insights, leadership wisdom, and building God's kingdom.
Emphasize long-term vision, organizational structure, and godly leadership principles.
Reference leaders like David, Nehemiah, and Solomon for wisdom.`,
      'creativefire': `Embrace poetic expression and prophetic insight.
Use creative metaphors, imagery, and artistic language.
Draw from the Psalms, Song of Solomon, and prophetic books.
Speak with passion and creative inspiration.`,
      'gospelpulse': `Center on the Gospel message and evangelistic outreach.
Emphasize the love of Christ, salvation, and sharing faith.
Be accessible to seekers and new believers.
Focus on the heart of the Gospel and its transformative power.`,
      'shepherdvoice': `Provide pastoral care, comfort, and healing guidance.
Be gentle, empathetic, and understanding.
Address emotional and spiritual needs with compassion.
Reference the Good Shepherd and pastoral epistles.`,
      'hebraicroots': `Offer academic depth and doctrinal precision.
Explore Hebrew/Greek word meanings and historical context.
Provide scholarly insights while remaining accessible.
Reference original languages and cultural background.`
    };

    const inspireModelNames = {
      'kingdombuilder': 'Kingdom Builder',
      'creativefire': 'Creative Fire',
      'gospelpulse': 'Gospel Pulse',
      'shepherdvoice': 'Shepherd Voice',
      'hebraicroots': 'Hebraic Roots'
    };

    // Query Qdrant collection for persona-specific context and behavioral rules
    // Following the working JubileePersonas RAG pipeline architecture
    let qdrantContext = '';
    let retrievalStats = { chunksRetrieved: 0, topScore: 0 };
    try {
      const database = require('../database');
      const qdrant = database.getQdrant();
      const qdrantCollection = config.qdrant.collection;

      // Only query if we have a real Qdrant connection (not mock)
      if (qdrant && !qdrant.mock) {
        // Extract persona first name for filtering (e.g., "Jubilee Inspire" -> "jubilee")
        const personaFirstName = personaName.toLowerCase().split(' ')[0];

        logger.info('Querying Qdrant for persona context', {
          message: message.substring(0, 50),
          collection: qdrantCollection,
          persona: personaFirstName
        });

        // Generate embedding for the user message using AIService (handles backup key)
        const AIService = require('../services/AIService');
        const embedding = await AIService.generateEmbedding(message);

        logger.debug('Qdrant search params', {
          collection: qdrantCollection,
          personaFilter: personaFirstName,
          embeddingLength: embedding?.length
        });

        // Build filter following working architecture:
        // - must: step_number <= 32 (lifecycle constraint)
        // - should: persona_scope matches persona OR 'all'
        const filter = {
          must: [
            { key: 'step_number', range: { lte: 32 } }
          ],
          should: [
            { key: 'persona_scope', match: { any: ['all'] } },
            { key: 'persona_scope', match: { any: [personaFirstName] } }
          ]
        };

        logger.debug('Qdrant filter config', {
          filter: JSON.stringify(filter),
          collection: qdrantCollection
        });

        // Search Qdrant with proper filter structure
        // First try with filter, if empty try without
        let searchResults = await qdrant.search(qdrantCollection, {
          vector: embedding,
          limit: 5,
          filter: filter,
          with_payload: true
          // Note: score_threshold removed - may cause issues with some clients
        });

        logger.debug('Qdrant search with filter result', {
          resultsCount: searchResults?.length || 0
        });

        // If filter returns nothing, try without filter and filter manually
        if (!searchResults || searchResults.length === 0) {
          logger.info('Filter returned no results, trying without filter');
          searchResults = await qdrant.search(qdrantCollection, {
            vector: embedding,
            limit: 10,
            with_payload: true
          });

          logger.debug('Qdrant search without filter result', {
            resultsCount: searchResults?.length || 0
          });

          // Filter manually by persona scope
          if (searchResults && searchResults.length > 0) {
            const beforeCount = searchResults.length;
            searchResults = searchResults.filter(r => {
              const scope = r.payload?.persona_scope || [];
              return scope.includes(personaFirstName) || scope.includes('all');
            });
            logger.debug('Manual persona filter applied', {
              beforeFilter: beforeCount,
              afterFilter: searchResults.length
            });
          }
        }

        logger.info('Qdrant search completed', {
          resultsCount: searchResults ? searchResults.length : 0,
          persona: personaFirstName,
          topScore: searchResults?.[0]?.score?.toFixed(3)
        });

        if (searchResults && searchResults.length > 0) {
          retrievalStats = {
            chunksRetrieved: searchResults.length,
            topScore: searchResults[0].score
          };

          // Format retrieved knowledge following working architecture pattern
          const formattedResults = searchResults.map(r => {
            const payload = r.payload || {};
            const source = payload.source_file || 'Inspire Knowledge';
            const step = payload.step_number ?? 'N/A';
            const contentType = payload.content_type || 'instruction';
            const score = r.score?.toFixed(2) || 'N/A';
            // Use 'text' field which contains the actual content
            const text = payload.text || payload.content || '';

            return `Source: ${source} (Step ${step}) | Type: ${contentType} | Score: ${score}
${text}`;
          }).join('\n\n---\n\n');

          // Wrap in clear tags following working architecture
          qdrantContext = `[RETRIEVED KNOWLEDGE FROM QDRANT]
${formattedResults}
[END RETRIEVED KNOWLEDGE]`;

          logger.info('Qdrant persona context retrieved', {
            contextLength: qdrantContext.length,
            sources: searchResults.map(r => r.payload?.source_file || 'unknown'),
            scores: searchResults.map(r => r.score?.toFixed(3))
          });
        } else {
          logger.warn('Qdrant search returned no results', {
            collection: qdrantCollection,
            persona: personaFirstName
          });
        }
      } else {
        logger.debug('Using mock Qdrant - no vector context retrieved');
      }
    } catch (qdrantError) {
      logger.error('Qdrant query failed', {
        error: qdrantError.message,
        stack: qdrantError.stack
      });
    }

    // Build the full system prompt following prompt.submit-template.md format
    const inspireModelName = inspireModelNames[inspireModel] || 'Gospel Pulse';
    const inspireModelDesc = inspireModelDescriptions[inspireModel] || inspireModelDescriptions['gospelpulse'];

    // Language instruction at the END to ensure it takes precedence
    const systemPrompt = `${basePrompt}

INSPIRE 8.0 MODE: ${inspireModelName}
${inspireModelDesc}
${qdrantContext ? `
PERSONA BEHAVIORAL INSTRUCTIONS AND COVENANT RULES:
You MUST follow these instructions as they define your character, behavior, and responses:

${qdrantContext}
` : ''}
GUIDELINES:
- Always respond with biblical accuracy and theological soundness
- Be warm, encouraging, and pastoral in your approach
- Reference Scripture when appropriate, providing book, chapter, and verse
- Keep responses conversational and helpful
- If you don't know something, acknowledge it honestly
- Apply the persona behavioral instructions above to shape your response style and content
${collaborationContext ? `\nContext from other personas in this conversation: ${collaborationContext}` : ''}

IMPORTANT: You MUST always respond in English, regardless of what language the user writes in. The system will translate your English response to the user's preferred language automatically. Never respond in any language other than English.`;

    // Set user context for token tracking
    AIService.setCurrentUserId(odUserId);

    // Extract persona slug for tracking (e.g., "Jubilee Inspire" -> "jubilee")
    const personaSlug = personaName.toLowerCase().split(' ')[0];

    const startTime = Date.now();
    const responseText = await AIService.generateResponse({
      systemPrompt,
      messages,
      maxTokens: 1024,
      temperature: 0.7,
      personaSlug
    });
    const processingTime = Date.now() - startTime;

    // Translate response to user's preferred language if not English
    let finalResponse = responseText;
    let wasTranslated = false;
    if (responseLanguage && responseLanguage !== 'en' && !responseLanguage.startsWith('en-')) {
      const translationResult = await AIService.translateResponse(responseText, responseLanguage);
      finalResponse = translationResult.translated;
      wasTranslated = translationResult.wasTranslated;
      logger.info('Response translated', {
        targetLanguage: responseLanguage,
        wasTranslated,
        originalLength: responseText.length,
        translatedLength: finalResponse.length
      });
    }

    // Save assistant message to database (store English original for canonical storage)
    if (!conversation.isTemporary) {
      try {
        await Message.create({
          conversationId: conversation.id,
          type: 'assistant',
          content: responseText, // Store English original
          modelUsed: 'gpt-4',
          modelVersion: inspireModel,
          processingTimeMs: processingTime
        });
        logger.debug('Saved assistant message in English');

        // Update conversation title if needed
        if (isNewConversation) {
          await Conversation.update(conversation.id, {
            title: conversation.title || message.substring(0, 50)
          });
        }
      } catch (dbError) {
        logger.warn('Could not save assistant message to DB', { error: dbError.message });
      }
    }
    // Note: Persona response tracking is handled centrally in AIService.generateResponse

    res.json({
      success: true,
      response: finalResponse, // Send translated response to client
      originalResponse: wasTranslated ? responseText : null, // Include original if translated
      responseLanguage: wasTranslated ? responseLanguage : 'en',
      personaName,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        isNew: isNewConversation,
        personaName,
        lastMessage: finalResponse.substring(0, 100) + (finalResponse.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString()
      },
      retrievalStats  // RAG stats: { chunksRetrieved, topScore }
    });
  } catch (error) {
    logger.error('Legacy chat error', { error: error.message, stack: error.stack });
    throw new AppError('Failed to generate response: ' + error.message, 500);
  }
});

/**
 * Legacy delete conversation endpoint
 * POST /Home/DeleteChatConversation
 *
 * For local/session-based conversations (not stored in database)
 */
const deleteChatConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.body;

  if (!conversationId) {
    throw new AppError('Conversation ID is required', 400);
  }

  logger.debug('Legacy delete conversation request', { conversationId });

  // For now, just acknowledge the deletion since conversations
  // are stored in browser sessionStorage/localStorage
  // When database integration is complete, this will delete from database

  res.json({
    success: true,
    message: 'Conversation deleted',
    conversationId
  });
});

/**
 * Legacy get conversations endpoint (for chat.html)
 * GET /Home/GetChatConversations
 */
const getChatConversations = asyncHandler(async (req, res) => {
  // Return conversations for logged-in user or empty array for guests
  if (!req.session.userId) {
    return res.json({
      success: true,
      conversations: []
    });
  }

  try {
    const conversations = await ConversationService.getUserConversations(
      req.session.userId,
      { limit: 50, offset: 0, status: 'active' }
    );

    // Transform to frontend format
    const formattedConversations = conversations.map(c => ({
      id: c.id,
      personaName: c.personaName || 'Jubilee Inspire',
      subject: c.title,
      preview: c.preview || c.title || 'New conversation...',
      messages: c.messages || [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      isUnread: c.isUnread || false
    }));

    res.json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    logger.error('Error getting chat conversations', { error: error.message });
    res.json({
      success: true,
      conversations: []
    });
  }
});

/**
 * Legacy get community users endpoint (for chat.html)
 * GET /Home/GetCommunityUsers
 */
const getCommunityUsers = asyncHandler(async (req, res) => {
  // Return empty array for now - community users feature not implemented
  res.json({
    success: true,
    users: []
  });
});

module.exports = {
  createConversation,
  getConversations,
  getConversation,
  getConversationsByMailbox,
  updateConversation,
  archiveConversation,
  deleteConversation,
  getMessages,
  sendMessage,
  sendMessageAsync,
  getRequestStatus,
  cancelRequest,
  searchConversations,
  getStats,
  chatWithJubilee,
  deleteChatConversation,
  getChatConversations,
  getCommunityUsers
};
