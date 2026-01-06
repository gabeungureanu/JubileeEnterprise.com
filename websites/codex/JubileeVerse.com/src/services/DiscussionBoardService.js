/**
 * Discussion Board Service
 * Handles discussion board operations and shared conversation spaces
 */

const logger = require('../utils/logger');
const { DiscussionBoard, User, BoardMessageTranslation } = require('../models');
const PersonaService = require('./PersonaService');
const AIService = require('./AIService');
const { getFirstNameFromUser } = require('../utils/name');
const TranslationService = require('./TranslationService');
const WebSocketService = require('../queue/WebSocketService');

const LANGUAGE_LABELS = {
  en: 'English',
  af: 'Afrikaans',
  sq: 'Albanian',
  am: 'Amharic',
  ar: 'Arabic',
  hy: 'Armenian',
  az: 'Azerbaijani',
  eu: 'Basque',
  be: 'Belarusian',
  bn: 'Bengali',
  bs: 'Bosnian',
  bg: 'Bulgarian',
  ca: 'Catalan',
  zh: 'Chinese (Mandarin)',
  'zh-tw': 'Chinese (Traditional)',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  et: 'Estonian',
  fo: 'Faroese',
  fi: 'Finnish',
  fr: 'French',
  gl: 'Galician',
  ka: 'Georgian',
  de: 'German',
  el: 'Greek',
  gu: 'Gujarati',
  ha: 'Hausa',
  he: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  is: 'Icelandic',
  ig: 'Igbo',
  id: 'Indonesian',
  ga: 'Irish',
  it: 'Italian',
  ja: 'Japanese',
  kn: 'Kannada',
  kk: 'Kazakh',
  ko: 'Korean',
  ky: 'Kyrgyz',
  lv: 'Latvian',
  lt: 'Lithuanian',
  mk: 'Macedonian',
  ms: 'Malay',
  ml: 'Malayalam',
  mt: 'Maltese',
  mr: 'Marathi',
  mn: 'Mongolian',
  ne: 'Nepali',
  no: 'Norwegian',
  ps: 'Pashto',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  'pt-br': 'Portuguese (Brazil)',
  pa: 'Punjabi',
  ro: 'Romanian',
  ru: 'Russian',
  sr: 'Serbian',
  sk: 'Slovak',
  sl: 'Slovenian',
  so: 'Somali',
  es: 'Spanish',
  sw: 'Swahili',
  sv: 'Swedish',
  tl: 'Tagalog (Filipino)',
  tg: 'Tajik',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tr: 'Turkish',
  tk: 'Turkmen',
  uk: 'Ukrainian',
  ur: 'Urdu',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  cy: 'Welsh',
  xh: 'Xhosa',
  yo: 'Yoruba',
  zu: 'Zulu'
};

const DETECT_LANGUAGE_MAP = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  portuguese: 'pt',
  russian: 'ru',
  chinese: 'zh',
  japanese: 'ja',
  korean: 'ko',
  arabic: 'ar',
  hebrew: 'he'
};

function normalizeLanguageCode(code) {
  if (!code) return null;
  return String(code).toLowerCase();
}

function getLanguageLabel(code) {
  return LANGUAGE_LABELS[code] || code;
}

function shouldTranslateMessage(content, targetLanguage) {
  if (!content || !targetLanguage) return false;
  const detection = TranslationService.detectLanguage(content);
  const detectedCode = DETECT_LANGUAGE_MAP[detection.language] || null;

  if (!detectedCode) {
    return targetLanguage !== 'en';
  }

  if (detectedCode === targetLanguage) {
    return false;
  }

  if (targetLanguage.startsWith('zh') && detectedCode === 'zh') {
    return false;
  }

  if (targetLanguage.startsWith('pt') && detectedCode === 'pt') {
    return false;
  }

  return true;
}

async function translateText(content, targetLanguage) {
  const provider = AIService.getDefaultProvider();
  if (!AIService.isProviderAvailable(provider)) {
    return null;
  }

  const label = getLanguageLabel(targetLanguage);
  const systemPrompt = [
    'You are a translation engine.',
    `Translate the message into ${label} (${targetLanguage}).`,
    'Preserve Scripture references, formatting, punctuation, and names.',
    'If the message is already in the target language, return it unchanged.',
    'Return only the translated text, no quotes, no explanations.'
  ].join('\n');

  return AIService.generateResponse({
    provider,
    systemPrompt,
    messages: [{ type: 'user', content }],
    maxTokens: 1024,
    temperature: 0.2
  });
}

/**
 * Translate text to English (the system's core language)
 * All user input must be translated to English before AI processing
 */
async function translateToEnglish(content) {
  if (!content || !content.trim()) {
    return content;
  }

  // Check for clearly non-Latin scripts that need translation (skip heuristic for these)
  const detection = TranslationService.detectLanguage(content);
  const detectedCode = DETECT_LANGUAGE_MAP[detection.language] || null;

  // Only skip if detected as a non-Latin language (like Hebrew, Arabic, Chinese, etc.)
  // For Latin-based text, we need AI to properly determine if it's English or not
  const nonLatinLanguages = ['hebrew', 'greek', 'arabic', 'chinese', 'japanese', 'korean', 'russian'];
  const isNonLatinDetected = nonLatinLanguages.includes(detection.language);

  // If non-Latin language detected, definitely translate
  if (isNonLatinDetected) {
    logger.debug('Non-Latin language detected, will translate', { detected: detection.language });
  }

  // For Latin-alphabet text, use a more reliable check:
  // Only skip translation if text contains multiple common English words together
  if (!isNonLatinDetected) {
    // Check for STRONG English indicators (multiple common words in context)
    const strongEnglishPatterns = [
      /\b(what does|how are|how do|what is|who is|where is|when is|why is)\b/i,
      /\b(I am|you are|he is|she is|they are|we are|it is)\b/i,
      /\b(the Lord|Jesus Christ|Holy Spirit|God is|Bible says)\b/i,
      /\b(please help|thank you|how can I|what can|let me)\b/i,
      /\b(have been|has been|will be|would be|could be|should be)\b/i
    ];

    const hasStrongEnglish = strongEnglishPatterns.some(pattern => pattern.test(content));

    if (hasStrongEnglish) {
      logger.debug('Strong English patterns detected, skipping translation', { content: content.substring(0, 50) });
      return content;
    }

    // For very short Latin text without strong patterns, use AI to detect & translate
    logger.debug('Latin text without strong English patterns, using AI to detect/translate', {
      content: content.substring(0, 50),
      detected: detection.language
    });
  }

  const provider = AIService.getDefaultProvider();
  if (!AIService.isProviderAvailable(provider)) {
    logger.warn('AI provider not available for translation to English');
    return content;
  }

  // VERY strict prompt - tell AI to detect language first, then translate if needed
  const systemPrompt = [
    'You are a language detection and translation engine.',
    '',
    'STEP 1: Detect if the text is in English or another language.',
    'STEP 2: If the text is already in English, return it EXACTLY as provided.',
    'STEP 3: If the text is in ANY other language (Spanish, French, Romanian, etc.), translate it to English.',
    '',
    'CRITICAL RULES:',
    '- NEVER answer questions. NEVER provide explanations.',
    '- If text says "Ce mai faci?" (Romanian for "How are you?"), return "How are you?"',
    '- If text says "What does John 3:16 say?", return "What does John 3:16 say?" (already English)',
    '- If text asks a question in another language, translate the QUESTION, do NOT answer it.',
    '- Return ONLY the translated/original text, nothing else.',
    '',
    'Examples:',
    '- "Ce mai faci?" → "How are you?"',
    '- "Ce spune Ioan 3:16?" → "What does John 3:16 say?"',
    '- "What does John 3:16 say?" → "What does John 3:16 say?"',
    '- "Bonjour, comment allez-vous?" → "Hello, how are you?"'
  ].join('\n');

  try {
    const translated = await AIService.generateResponse({
      provider,
      systemPrompt,
      messages: [{ type: 'user', content }],
      maxTokens: 1024,
      temperature: 0.1  // Lower temperature for more predictable output
    });

    if (translated && translated.trim()) {
      // Safety check: if translation is much longer than original, it might have answered instead of translated
      if (translated.length > content.length * 3) {
        logger.warn('Translation suspiciously long, using original', {
          originalLength: content.length,
          translatedLength: translated.length
        });
        return content;
      }

      logger.debug('Translated user message to English', {
        originalLength: content.length,
        translatedLength: translated.length,
        detectedLanguage: detection.language
      });
      return translated.trim();
    }
    return content;
  } catch (error) {
    logger.warn('Failed to translate to English, using original content', { error: error.message });
    return content;
  }
}

const BOARD_WELCOME_TITLES = {
  'kingdom-builder': 'Welcome to Kingdom Builder',
  'creative-fire': 'Welcome to Creative Fire',
  'gospel-pulse': 'Welcome to Gospel Pulse',
  'shepherds-voice': "Welcome to Shepherd's Voice",
  'hebraic-roots': 'Welcome to Hebraic Roots'
};

const BOARD_INTRO_MESSAGES = {
  'kingdom-builder': function(name) {
    return `Shalom ${name}! I'm Elias Inspire. I'm excited to welcome you to Kingdom Builder, our apostolic space for leadership, strategy, and kingdom foundations. Share what you're building or leading, and let's seek the Lord together.`;
  },
  'creative-fire': function(name) {
    return `Bendiciones ${name}! I'm Santiago Inspire. I'm glad you're here in Creative Fire, a prophetic and creative space for worship, arts, and Spirit-led expression. Bring your ideas, questions, or works in progress.`;
  },
  'gospel-pulse': function(name) {
    return `Shalom ${name}! I'm Jubilee Inspire. Welcome to Gospel Pulse, our evangelism and outreach board. Let's talk about sharing the Good News, praying for the lost, and living as bold witnesses.`;
  },
  'shepherds-voice': function(name) {
    return `Hello ${name}! I'm Caleb Inspire. I'm grateful you're here in Shepherd's Voice, a pastoral space for care, encouragement, and healing. Share what's on your heart, and we'll walk with you.`;
  },
  'hebraic-roots': function(name) {
    return `Peace ${name}! I'm Zev Inspire. Welcome to Hebraic Roots, a teaching-focused space for Hebrew foundations, biblical context, and Scripture study. Bring your questions about Torah, language, or traditions.`;
  }
};

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
    logger.warn('Failed to resolve user for board greeting', { userId, error: error.message });
    return userInfo || null;
  }
}

function buildBoardIntroMessage(board, firstName) {
  const name = firstName || 'friend';
  const builder = BOARD_INTRO_MESSAGES[board.slug];
  if (builder) {
    return builder(name);
  }
  const boardName = board?.name || 'this board';
  return `Hello ${name}! Welcome to ${boardName}. This is a shared discussion space for our community. How can we encourage you today?`;
}

/**
 * Get all discussion boards
 */
async function getAllBoards(options = {}) {
  logger.debug('Getting all boards', options);

  try {
    return await DiscussionBoard.getAllBoards(options);
  } catch (error) {
    logger.error('Failed to get boards', { error: error.message });
    throw error;
  }
}

/**
 * Get board by slug
 */
async function getBoardBySlug(slug) {
  logger.debug('Getting board by slug', { slug });

  try {
    const board = await DiscussionBoard.getBoardBySlug(slug);
    if (!board) {
      throw new Error('Board not found');
    }
    return board;
  } catch (error) {
    logger.error('Failed to get board', { slug, error: error.message });
    throw error;
  }
}

/**
 * Get board by ID
 */
async function getBoardById(boardId) {
  logger.debug('Getting board by ID', { boardId });

  try {
    const board = await DiscussionBoard.getBoardById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }
    return board;
  } catch (error) {
    logger.error('Failed to get board', { boardId, error: error.message });
    throw error;
  }
}

/**
 * Join a board
 */
async function joinBoard(boardId, userId) {
  logger.debug('User joining board', { boardId, userId });

  try {
    const membership = await DiscussionBoard.joinBoard(boardId, userId);
    logger.info('User joined board', { boardId, userId });
    return membership;
  } catch (error) {
    logger.error('Failed to join board', { boardId, userId, error: error.message });
    throw error;
  }
}

/**
 * Leave a board
 */
async function leaveBoard(boardId, userId) {
  logger.debug('User leaving board', { boardId, userId });

  try {
    await DiscussionBoard.leaveBoard(boardId, userId);
    logger.info('User left board', { boardId, userId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to leave board', { boardId, userId, error: error.message });
    throw error;
  }
}

/**
 * Get user's boards
 */
async function getUserBoards(userId) {
  logger.debug('Getting user boards', { userId });

  try {
    return await DiscussionBoard.getUserBoards(userId);
  } catch (error) {
    logger.error('Failed to get user boards', { userId, error: error.message });
    throw error;
  }
}

/**
 * Create a new conversation in a board
 */
async function createConversation(data) {
  const { boardId, communityId, userId, title, description, initialMessage } = data;

  logger.debug('Creating board conversation', { boardId, userId, title });

  try {
    // Get board to find default persona
    const board = await DiscussionBoard.getBoardById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    // Get the default persona for this board
    const personaSlug = DiscussionBoard.getDefaultPersonaSlug(board.slug);
    let persona = null;
    try {
      persona = await PersonaService.getPersonaBySlug(personaSlug);
    } catch (e) {
      logger.warn('Default persona not found, using fallback', { personaSlug });
    }

    // Create the conversation
    const conversation = await DiscussionBoard.createConversation({
      boardId,
      communityId,
      authorId: userId,
      title,
      description,
      personaId: persona?.id || board.defaultPersonaId
    });

    // Add the initial message if provided
    if (initialMessage) {
      await DiscussionBoard.createMessage({
        boardConversationId: conversation.id,
        authorId: userId,
        content: initialMessage,
        isAiResponse: false
      });
    }

    // Broadcast new conversation to all users with active WebSocket connections
    // Each client will check if they're viewing the relevant board and update their list
    try {
      WebSocketService.broadcastToAll({
        type: 'board_new_conversation',
        boardId,
        communityId,
        boardSlug: board.slug,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          boardId,
          communityId,
          personaName: persona?.name || null,
          createdAt: conversation.createdAt
        }
      }, { excludeUserId: userId });
    } catch (broadcastError) {
      logger.warn('Failed to broadcast new conversation', { error: broadcastError.message });
    }

    logger.info('Board conversation created', { conversationId: conversation.id, boardId });

    return conversation;
  } catch (error) {
    logger.error('Failed to create board conversation', { boardId, error: error.message });
    throw error;
  }
}

/**
 * Ensure a seeded conversation exists for a board + community
 * NOTE: AI personas should NOT respond first - user must send the first message
 */
async function ensureSeedConversation(options) {
  const { board, communityId, userId, user } = options;
  if (!board || !communityId || !userId) return null;

  const existing = await DiscussionBoard.getBoardConversations(board.id, {
    limit: 1,
    offset: 0,
    status: 'active',
    communityId
  });

  if (existing.length > 0) {
    return null;
  }

  const title = BOARD_WELCOME_TITLES[board.slug] || `Welcome to ${board.name}`;

  let persona = null;
  const personaSlug = DiscussionBoard.getDefaultPersonaSlug(board.slug);
  if (personaSlug) {
    try {
      persona = await PersonaService.getPersonaBySlug(personaSlug);
    } catch (error) {
      logger.warn('Default persona not found for board seed', { board: board.slug, personaSlug });
    }
  }

  // Create empty conversation - AI personas should NOT respond first
  // User must send the first message to initiate conversation
  const conversation = await DiscussionBoard.createConversation({
    boardId: board.id,
    communityId,
    authorId: userId,
    title,
    description: null,
    personaId: persona?.id || board.defaultPersonaId
  });

  // No auto-seeded AI greeting message - user speaks first
  logger.info('Created empty board conversation (user speaks first)', { boardId: board.id, communityId, conversationId: conversation.id });

  return conversation;
}

/**
 * Get conversations for a board
 */
async function getBoardConversations(boardId, options = {}) {
  logger.debug('Getting board conversations', { boardId, ...options });

  try {
    return await DiscussionBoard.getBoardConversations(boardId, options);
  } catch (error) {
    logger.error('Failed to get board conversations', { boardId, error: error.message });
    throw error;
  }
}

/**
 * Get a conversation by ID
 */
async function getConversation(conversationId) {
  logger.debug('Getting conversation', { conversationId });

  try {
    const conversation = await DiscussionBoard.getConversationById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  } catch (error) {
    logger.error('Failed to get conversation', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Get messages for a conversation
 */
async function getConversationMessages(conversationId, options = {}) {
  logger.debug('Getting conversation messages', { conversationId, ...options });

  try {
    const messages = await DiscussionBoard.getConversationMessages(conversationId, options);
    return applyMessageTranslations(messages, options.targetLanguage);
  } catch (error) {
    logger.error('Failed to get conversation messages', { conversationId, error: error.message });
    throw error;
  }
}

async function applyMessageTranslations(messages, targetLanguage) {
  const languageCode = normalizeLanguageCode(targetLanguage);
  if (!languageCode || !messages || messages.length === 0) {
    return messages;
  }

  const messageIds = messages.map(msg => msg.id);
  const existingTranslations = await BoardMessageTranslation.findByMessageIdsAndLanguage(messageIds, languageCode);
  const translationMap = new Map(
    existingTranslations.map(item => [item.boardMessageId, item.translatedContent])
  );

  const translatedMessages = [];

  for (const msg of messages) {
    let translatedContent = translationMap.get(msg.id);
    let shouldStore = false;

    if (!translatedContent) {
      if (shouldTranslateMessage(msg.content, languageCode)) {
        try {
          const translated = await translateText(msg.content, languageCode);
          if (translated && translated.trim()) {
            translatedContent = translated.trim();
            shouldStore = true;
          } else {
            translatedContent = msg.content;
          }
        } catch (error) {
          logger.warn('Failed to translate board message', {
            error: error.message,
            boardMessageId: msg.id,
            language: languageCode
          });
          translatedContent = msg.content;
        }
      } else {
        translatedContent = msg.content;
        shouldStore = true;
      }

      if (shouldStore) {
        await BoardMessageTranslation.upsertTranslation({
          boardMessageId: msg.id,
          language: languageCode,
          translatedContent,
          provider: AIService.getDefaultProvider()
        });
      }
    }

    translatedMessages.push({
      ...msg,
      content: translatedContent || msg.content,
      originalContent: msg.content,
      translatedLanguage: languageCode
    });
  }

  return translatedMessages;
}

/**
 * Post a message to a board conversation
 */
async function postMessage(data) {
  const { conversationId, userId, content, requestAiResponse = false, communityId = null } = data;

  logger.debug('Posting message', { conversationId, userId, requestAiResponse });

  try {
    // Get conversation to find community/board info
    const conversation = await DiscussionBoard.getConversationById(conversationId);

    // CANONICAL ENGLISH STORAGE: Translate user message to English before storing
    // This ensures all messages are stored in English (the system's core language)
    // Receiving clients translate from English to their preferred language
    const englishContent = await translateToEnglish(content);
    logger.debug('Message translated to English for storage', {
      original: content.substring(0, 50),
      translated: englishContent?.substring(0, 50)
    });

    // Create user message with English content
    const userMessage = await DiscussionBoard.createMessage({
      boardConversationId: conversationId,
      authorId: userId,
      content: englishContent || content, // Fallback to original if translation fails
      isAiResponse: false
    });

    // Broadcast user message to OTHER users (exclude the sender who already sees it)
    broadcastBoardMessage(conversationId, {
      type: 'board_message',
      conversationId,
      communityId: communityId || conversation?.communityId,
      boardId: conversation?.boardId,
      message: userMessage
    }, { excludeUserId: userId });

    // CLIENT-SIDE TRANSLATION: User messages are broadcast in their original form (English after server translation)
    // The receiving client handles translation to the user's preferred language
    // No server-side translation broadcast needed

    let aiMessage = null;

    // Generate AI response if requested
    // The AI response is streamed via WebSocket to ALL users (including sender)
    // through the streaming broadcasts in generateAiResponse()
    if (requestAiResponse) {
      aiMessage = await generateAiResponse(conversationId, content);
      // Note: AI response is already broadcasted via streaming to all users
      // No separate broadcast needed here
    }

    logger.info('Message posted', { messageId: userMessage.id, conversationId });

    return {
      userMessage,
      aiMessage
    };
  } catch (error) {
    logger.error('Failed to post message', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Broadcast a message to all clients subscribed to a board conversation
 * @param {string} conversationId - The conversation ID
 * @param {object} messageData - The message data to broadcast
 * @param {object} options - Options: excludeUserId to exclude a specific user from receiving
 */
function broadcastBoardMessage(conversationId, messageData, options = {}) {
  try {
    WebSocketService.broadcastToBoardConversation(conversationId, messageData, options);
  } catch (error) {
    logger.warn('Failed to broadcast board message', { conversationId, error: error.message });
  }
}


/**
 * Generate AI response for a board conversation with streaming
 * - Server ALWAYS generates and broadcasts in ENGLISH
 * - Client-side translation layer handles converting to user's language
 * - All content transmitted over WebSocket is in English
 */
async function generateAiResponse(conversationId, userContent) {
  const { v4: uuidv4 } = require('uuid');
  logger.debug('Generating AI response for board conversation', { conversationId });

  try {
    // Get conversation details
    const conversation = await DiscussionBoard.getConversationById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Get the board to find the persona
    const board = await DiscussionBoard.getBoardById(conversation.boardId);

    // Get the persona for this board
    let persona = null;
    if (conversation.personaId) {
      try {
        persona = await PersonaService.getPersonaById(conversation.personaId);
      } catch (e) {
        logger.warn('Conversation persona not found', { personaId: conversation.personaId });
      }
    }

    if (!persona) {
      const personaSlug = DiscussionBoard.getDefaultPersonaSlug(board.slug);
      try {
        persona = await PersonaService.getPersonaBySlug(personaSlug);
      } catch (e) {
        logger.warn('Default board persona not found', { personaSlug });
      }
    }

    // Get recent messages for context
    const recentMessages = await DiscussionBoard.getConversationMessages(conversationId, {
      limit: 10,
      order: 'desc'
    });

    // Format messages for AI - messages are stored in English
    const contextMessages = [];
    for (const msg of recentMessages.reverse()) {
      contextMessages.push({
        type: msg.isAiResponse ? 'assistant' : 'user',
        content: msg.content
      });
    }

    // Build system prompt in English
    let systemPrompt = '';
    if (persona) {
      systemPrompt = PersonaService.buildSystemPrompt(persona, {
        conversationContext: `This is a community discussion in the "${board.name}" board. Multiple users may participate.`
      });
    } else {
      systemPrompt = `You are a helpful AI assistant participating in a community discussion board called "${board.name}". ${board.description || ''} Be helpful, respectful, and engage thoughtfully with the community.`;
    }

    // CRITICAL: Always respond in English - the system handles translation to other languages
    systemPrompt += '\n\nIMPORTANT: You MUST always respond in English, regardless of what language the user writes in. The system will translate your English response to the user\'s preferred language automatically. Never respond in any language other than English.';

    // Generate a temporary streaming ID
    const streamingId = uuidv4();
    const personaName = persona?.name || 'Bible Persona';

    // Broadcast streaming start to ALL users (content is always English)
    broadcastBoardMessage(conversationId, {
      type: 'board_ai_stream_start',
      conversationId,
      communityId: conversation.communityId,
      boardId: conversation.boardId,
      streamingId,
      personaName,
      personaId: persona?.id
    });

    // Generate response with streaming in ENGLISH
    // Try streaming first, fall back to non-streaming if connection fails
    let response;
    let streamingFailed = false;
    let partialContent = '';

    // Extract persona slug for tracking (e.g., "Jubilee Inspire" -> "jubilee")
    const personaSlug = personaName ? personaName.toLowerCase().split(' ')[0] : null;

    try {
      response = await AIService.generateResponseStreaming({
        systemPrompt,
        messages: contextMessages,
        maxTokens: 1024,
        temperature: 0.7,
        personaSlug
      }, (chunk, fullContent) => {
        partialContent = fullContent;
        // Broadcast each chunk to ALL users (English content - client translates)
        broadcastBoardMessage(conversationId, {
          type: 'board_ai_stream_chunk',
          conversationId,
          streamingId,
          chunk,
          fullContent
        });
      });
    } catch (streamError) {
      // Streaming failed - check if we have partial content or need to retry
      logger.warn('Streaming failed, attempting fallback', {
        conversationId,
        error: streamError.message,
        partialContentLength: partialContent.length
      });

      streamingFailed = true;

      // If we have substantial partial content (more than 50 chars), use it
      if (partialContent && partialContent.length > 50) {
        logger.info('Using partial streamed content as response', {
          conversationId,
          contentLength: partialContent.length
        });
        response = partialContent;
      } else {
        // Try non-streaming fallback
        logger.info('Attempting non-streaming fallback', { conversationId });
        try {
          response = await AIService.generateResponse({
            systemPrompt,
            messages: contextMessages,
            maxTokens: 1024,
            temperature: 0.7,
            personaSlug
          });
        } catch (fallbackError) {
          logger.error('Non-streaming fallback also failed', {
            conversationId,
            error: fallbackError.message
          });
          // Broadcast error to clients
          broadcastBoardMessage(conversationId, {
            type: 'board_ai_stream_error',
            conversationId,
            streamingId,
            error: 'AI service temporarily unavailable. Please try again.'
          });
          throw fallbackError;
        }
      }
    }

    // Save AI message in English (canonical storage)
    const aiMessage = await DiscussionBoard.createMessage({
      boardConversationId: conversationId,
      personaId: persona?.id || null,
      content: response,
      isAiResponse: true,
      modelUsed: 'gpt-4'
    });

    // Broadcast streaming complete to ALL users (English content - client translates)
    broadcastBoardMessage(conversationId, {
      type: 'board_ai_stream_complete',
      conversationId,
      communityId: conversation.communityId,
      boardId: conversation.boardId,
      streamingId,
      message: aiMessage,
      wasRecovered: streamingFailed
    });

    logger.info('AI response generated for board', {
      conversationId,
      messageId: aiMessage.id,
      streaming: !streamingFailed,
      recovered: streamingFailed && partialContent.length > 50
    });

    return aiMessage;
  } catch (error) {
    logger.error('Failed to generate AI response', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Get active languages from connected users for a conversation
 * Returns list of non-English language codes that users have selected
 */
function getActiveLanguagesForConversation(conversationId) {
  const WebSocketService = require('../queue/WebSocketService');
  const activeLanguages = new Set();

  // Get all connection IDs subscribed to this conversation's board
  const connectionIds = WebSocketService.boardConversationConnections?.get(conversationId);
  if (!connectionIds || connectionIds.size === 0) {
    return [];
  }

  // Check each connection's language preference (stored in connection metadata)
  for (const connectionId of connectionIds) {
    const connection = WebSocketService.connections?.get(connectionId);
    if (connection && connection.language && connection.language !== 'en') {
      activeLanguages.add(connection.language);
    }
  }

  return Array.from(activeLanguages);
}

/**
 * Translate a message and broadcast translations to non-English users
 * Runs asynchronously after message is saved to avoid blocking the main flow
 */
async function translateAndBroadcastMessage(conversationId, message) {
  // Get active non-English languages for this conversation
  const activeLanguages = getActiveLanguagesForConversation(conversationId);

  if (activeLanguages.length === 0) {
    logger.debug('No non-English users connected, skipping translation', { conversationId });
    return;
  }

  logger.info('Translating message for active languages', {
    conversationId,
    messageId: message.id,
    languages: activeLanguages
  });

  // Translate to each active language
  for (const languageCode of activeLanguages) {
    try {
      // Check if translation already exists
      const existing = await BoardMessageTranslation.findByMessageAndLanguage(message.id, languageCode);
      let translatedContent;

      if (existing) {
        translatedContent = existing.translatedContent;
      } else {
        // Translate the message
        translatedContent = await translateText(message.content, languageCode);

        if (translatedContent && translatedContent.trim()) {
          // Store the translation
          await BoardMessageTranslation.upsertTranslation({
            boardMessageId: message.id,
            language: languageCode,
            translatedContent: translatedContent.trim(),
            provider: AIService.getDefaultProvider()
          });
        } else {
          // Translation failed, use original content
          translatedContent = message.content;
        }
      }

      // Broadcast the translated message update to users with this language
      broadcastBoardMessage(conversationId, {
        type: 'board_message_translated',
        conversationId,
        messageId: message.id,
        language: languageCode,
        translatedContent,
        originalContent: message.content
      });

      logger.debug('Translation broadcasted', {
        messageId: message.id,
        language: languageCode
      });
    } catch (error) {
      logger.warn('Failed to translate message for language', {
        messageId: message.id,
        language: languageCode,
        error: error.message
      });
    }
  }
}

/**
 * Like a message
 */
async function likeMessage(messageId, userId) {
  logger.debug('Liking message', { messageId, userId });

  try {
    await DiscussionBoard.likeMessage(messageId, userId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to like message', { messageId, userId, error: error.message });
    throw error;
  }
}

/**
 * Unlike a message
 */
async function unlikeMessage(messageId, userId) {
  logger.debug('Unliking message', { messageId, userId });

  try {
    await DiscussionBoard.unlikeMessage(messageId, userId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to unlike message', { messageId, userId, error: error.message });
    throw error;
  }
}

/**
 * Search conversations in a board
 */
async function searchConversations(boardId, query, options = {}) {
  logger.debug('Searching conversations', { boardId, query });

  try {
    return await DiscussionBoard.searchConversations(boardId, query, options);
  } catch (error) {
    logger.error('Failed to search conversations', { boardId, query, error: error.message });
    throw error;
  }
}

/**
 * Search messages in a board
 */
async function searchMessages(boardId, query, options = {}) {
  logger.debug('Searching messages', { boardId, query });

  try {
    return await DiscussionBoard.searchMessages(boardId, query, options);
  } catch (error) {
    logger.error('Failed to search messages', { boardId, query, error: error.message });
    throw error;
  }
}

/**
 * Delete a board conversation and all associated data
 * This includes all messages and their translations
 */
async function deleteConversation(conversationId) {
  logger.debug('Deleting board conversation', { conversationId });

  try {
    // Get conversation details first (for broadcast info)
    const conversation = await DiscussionBoard.getConversationById(conversationId);
    const boardId = conversation?.boardId;
    const communityId = conversation?.communityId;

    // Get board slug for the broadcast
    let boardSlug = null;
    if (boardId) {
      try {
        const board = await DiscussionBoard.getBoardById(boardId);
        boardSlug = board?.slug;
      } catch (e) {
        logger.debug('Could not get board slug for deletion broadcast', { boardId });
      }
    }

    // First, get all message IDs for this conversation (needed to delete translations)
    const messages = await DiscussionBoard.getConversationMessages(conversationId, { limit: 10000 });
    const messageIds = messages.map(m => m.id);

    // Delete translations for all messages in this conversation
    if (messageIds.length > 0) {
      await DiscussionBoard.deleteMessageTranslations(messageIds);
      logger.debug('Deleted translations for messages', { conversationId, messageCount: messageIds.length });
    }

    // Delete all messages in the conversation
    await DiscussionBoard.deleteConversationMessages(conversationId);
    logger.debug('Deleted messages for conversation', { conversationId });

    // Delete the conversation itself
    await DiscussionBoard.deleteConversation(conversationId);

    // Broadcast deletion to all connected users
    try {
      WebSocketService.broadcastToAll({
        type: 'board_conversation_deleted',
        conversationId,
        boardId,
        boardSlug,
        communityId
      });
    } catch (broadcastError) {
      logger.warn('Failed to broadcast conversation deletion', { error: broadcastError.message });
    }

    logger.info('Board conversation deleted', { conversationId, messagesDeleted: messageIds.length });

    return { success: true, messagesDeleted: messageIds.length };
  } catch (error) {
    logger.error('Failed to delete board conversation', { conversationId, error: error.message });
    throw error;
  }
}

/**
 * Translate text for client-side translation layer
 * This is exposed for the /api/boards/translate endpoint
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateTextForClient(text, targetLanguage) {
  if (!text || !text.trim()) {
    return text;
  }

  // Use the existing translateText function
  const translated = await translateText(text, targetLanguage);
  return translated || text;
}

module.exports = {
  getAllBoards,
  getBoardBySlug,
  getBoardById,
  joinBoard,
  leaveBoard,
  getUserBoards,
  createConversation,
  getBoardConversations,
  ensureSeedConversation,
  getConversation,
  getConversationMessages,
  postMessage,
  generateAiResponse,
  likeMessage,
  unlikeMessage,
  searchConversations,
  searchMessages,
  deleteConversation,
  translateTextForClient,
  translateToEnglish
};
