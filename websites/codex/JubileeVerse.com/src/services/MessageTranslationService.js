/**
 * Message Translation Service
 * Handles translation caching and retrieval for chat messages and conversations
 */

const database = require('../database');
const logger = require('../utils/logger');
const AIService = require('./AIService');

/**
 * Get cached translation for a message
 * @param {string} messageId - Message UUID
 * @param {string} languageCode - Target language code
 * @returns {string|null} Translated content or null if not cached
 */
async function getCachedMessageTranslation(messageId, languageCode) {
  try {
    const pool = database.getPostgres();
    const result = await pool.query(
      `SELECT translated_content FROM message_translations
       WHERE message_id = $1 AND language_code = $2`,
      [messageId, languageCode]
    );
    return result.rows.length > 0 ? result.rows[0].translated_content : null;
  } catch (error) {
    logger.error('Failed to get cached message translation', { messageId, languageCode, error: error.message });
    return null;
  }
}

/**
 * Save translation for a message
 * @param {string} messageId - Message UUID
 * @param {string} languageCode - Target language code
 * @param {string} translatedContent - Translated text
 */
async function saveMessageTranslation(messageId, languageCode, translatedContent) {
  try {
    const pool = database.getPostgres();
    await pool.query(
      `INSERT INTO message_translations (message_id, language_code, translated_content)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, language_code) DO UPDATE SET translated_content = $3`,
      [messageId, languageCode, translatedContent]
    );
    logger.debug('Saved message translation', { messageId, languageCode });
  } catch (error) {
    logger.error('Failed to save message translation', { messageId, languageCode, error: error.message });
  }
}

/**
 * Get cached translation for a conversation title
 * @param {string} conversationId - Conversation UUID
 * @param {string} languageCode - Target language code
 * @returns {string|null} Translated title or null if not cached
 */
async function getCachedTitleTranslation(conversationId, languageCode) {
  try {
    const pool = database.getPostgres();
    const result = await pool.query(
      `SELECT translated_title FROM conversation_translations
       WHERE conversation_id = $1 AND language_code = $2`,
      [conversationId, languageCode]
    );
    return result.rows.length > 0 ? result.rows[0].translated_title : null;
  } catch (error) {
    logger.error('Failed to get cached title translation', { conversationId, languageCode, error: error.message });
    return null;
  }
}

/**
 * Save translation for a conversation title
 * @param {string} conversationId - Conversation UUID
 * @param {string} languageCode - Target language code
 * @param {string} translatedTitle - Translated title
 */
async function saveTitleTranslation(conversationId, languageCode, translatedTitle) {
  try {
    const pool = database.getPostgres();
    await pool.query(
      `INSERT INTO conversation_translations (conversation_id, language_code, translated_title)
       VALUES ($1, $2, $3)
       ON CONFLICT (conversation_id, language_code) DO UPDATE SET translated_title = $3`,
      [conversationId, languageCode, translatedTitle]
    );
    logger.debug('Saved title translation', { conversationId, languageCode });
  } catch (error) {
    logger.error('Failed to save title translation', { conversationId, languageCode, error: error.message });
  }
}

/**
 * Translate a message and cache the result
 * @param {Object} message - Message object with id and content
 * @param {string} languageCode - Target language code
 * @returns {string} Translated content
 */
async function translateAndCacheMessage(message, languageCode) {
  if (!message || !message.content || !languageCode || languageCode === 'en' || languageCode.startsWith('en-')) {
    return message?.content || '';
  }

  // Check cache first
  const cached = await getCachedMessageTranslation(message.id, languageCode);
  if (cached) {
    logger.debug('Using cached message translation', { messageId: message.id, languageCode });
    return cached;
  }

  // Translate and cache
  try {
    const translated = await AIService.translateFromEnglish(message.content, languageCode);
    // Save to cache asynchronously (don't wait)
    saveMessageTranslation(message.id, languageCode, translated).catch(() => {});
    return translated;
  } catch (error) {
    logger.error('Translation failed, returning original', { messageId: message.id, error: error.message });
    return message.content;
  }
}

/**
 * Translate a conversation title and cache the result
 * @param {string} conversationId - Conversation UUID
 * @param {string} title - Original title
 * @param {string} languageCode - Target language code
 * @returns {string} Translated title
 */
async function translateAndCacheTitle(conversationId, title, languageCode) {
  if (!title || !languageCode || languageCode === 'en' || languageCode.startsWith('en-')) {
    return title || '';
  }

  // Check cache first
  const cached = await getCachedTitleTranslation(conversationId, languageCode);
  if (cached) {
    logger.debug('Using cached title translation', { conversationId, languageCode });
    return cached;
  }

  // Translate and cache
  try {
    const translated = await AIService.translateFromEnglish(title, languageCode);
    // Save to cache asynchronously (don't wait)
    saveTitleTranslation(conversationId, languageCode, translated).catch(() => {});
    return translated;
  } catch (error) {
    logger.error('Title translation failed, returning original', { conversationId, error: error.message });
    return title;
  }
}

/**
 * Translate multiple messages efficiently
 * @param {Array} messages - Array of message objects
 * @param {string} languageCode - Target language code
 * @returns {Array} Messages with translated content
 */
async function translateMessages(messages, languageCode) {
  if (!messages || messages.length === 0 || !languageCode || languageCode === 'en' || languageCode.startsWith('en-')) {
    return messages;
  }

  return Promise.all(messages.map(async (msg) => {
    // Only translate assistant messages
    if (msg.type !== 'assistant' || !msg.content) {
      return msg;
    }

    const translatedContent = await translateAndCacheMessage(msg, languageCode);
    return {
      ...msg,
      content: translatedContent,
      originalContent: msg.content !== translatedContent ? msg.content : null
    };
  }));
}

/**
 * Clear translations for a message (when content changes)
 * @param {string} messageId - Message UUID
 */
async function clearMessageTranslations(messageId) {
  try {
    const pool = database.getPostgres();
    await pool.query('DELETE FROM message_translations WHERE message_id = $1', [messageId]);
  } catch (error) {
    logger.error('Failed to clear message translations', { messageId, error: error.message });
  }
}

/**
 * Clear translations for a conversation title (when title changes)
 * @param {string} conversationId - Conversation UUID
 */
async function clearTitleTranslations(conversationId) {
  try {
    const pool = database.getPostgres();
    await pool.query('DELETE FROM conversation_translations WHERE conversation_id = $1', [conversationId]);
  } catch (error) {
    logger.error('Failed to clear title translations', { conversationId, error: error.message });
  }
}

module.exports = {
  getCachedMessageTranslation,
  saveMessageTranslation,
  getCachedTitleTranslation,
  saveTitleTranslation,
  translateAndCacheMessage,
  translateAndCacheTitle,
  translateMessages,
  clearMessageTranslations,
  clearTitleTranslations
};
