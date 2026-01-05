/**
 * Translation Service
 * Handles Bible translation workflows, language detection, and translation utilities
 */

const config = require('../config');
const logger = require('../utils/logger');
const { Translation } = require('../models');
const { SUPPORTED_LANGUAGES, BIBLE_BOOKS } = require('../config/constants');

// Language code to full name mapping for AI prompts
const LANGUAGE_NAMES = {
  en: 'English', af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', ar: 'Arabic',
  hy: 'Armenian', az: 'Azerbaijani', eu: 'Basque', be: 'Belarusian', bn: 'Bengali',
  bs: 'Bosnian', bg: 'Bulgarian', ca: 'Catalan', zh: 'Chinese (Mandarin)',
  'zh-tw': 'Chinese (Traditional)', hr: 'Croatian', cs: 'Czech', da: 'Danish',
  nl: 'Dutch', et: 'Estonian', fo: 'Faroese', fi: 'Finnish', fr: 'French',
  gl: 'Galician', ka: 'Georgian', de: 'German', el: 'Greek', gu: 'Gujarati',
  ha: 'Hausa', he: 'Hebrew', hi: 'Hindi', hu: 'Hungarian', is: 'Icelandic',
  ig: 'Igbo', id: 'Indonesian', ga: 'Irish', it: 'Italian', ja: 'Japanese',
  kn: 'Kannada', kk: 'Kazakh', ko: 'Korean', ky: 'Kyrgyz', lv: 'Latvian',
  lt: 'Lithuanian', mk: 'Macedonian', ms: 'Malay', ml: 'Malayalam', mt: 'Maltese',
  mr: 'Marathi', mn: 'Mongolian', ne: 'Nepali', no: 'Norwegian', ps: 'Pashto',
  fa: 'Persian', pl: 'Polish', pt: 'Portuguese', 'pt-br': 'Portuguese (Brazil)',
  pa: 'Punjabi', ro: 'Romanian', ru: 'Russian', sr: 'Serbian', sk: 'Slovak',
  sl: 'Slovenian', so: 'Somali', es: 'Spanish', sw: 'Swahili', sv: 'Swedish',
  tl: 'Tagalog', tg: 'Tajik', ta: 'Tamil', te: 'Telugu', th: 'Thai', tr: 'Turkish',
  tk: 'Turkmen', uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek', vi: 'Vietnamese',
  cy: 'Welsh', xh: 'Xhosa', yo: 'Yoruba', zu: 'Zulu'
};

/**
 * Get translation progress for a language
 */
async function getTranslationProgress(targetLanguage) {
  logger.debug('Getting translation progress', { targetLanguage });

  try {
    const stats = await Translation.getLanguageStats(targetLanguage);

    return {
      language: targetLanguage,
      totalBooks: BIBLE_BOOKS.length,
      completedBooks: stats.completedBooks || 0,
      totalVerses: stats.totalVerses || 0,
      translatedVerses: stats.translatedVerses || 0,
      reviewedVerses: stats.reviewedVerses || 0,
      percentComplete: stats.totalVerses > 0
        ? Math.round((stats.translatedVerses / stats.totalVerses) * 100)
        : 0,
      percentReviewed: stats.translatedVerses > 0
        ? Math.round((stats.reviewedVerses / stats.translatedVerses) * 100)
        : 0
    };
  } catch (error) {
    logger.error('Failed to get translation progress', { targetLanguage, error: error.message });
    throw error;
  }
}

/**
 * Get book translation progress
 */
async function getBookProgress(targetLanguage, bookId) {
  logger.debug('Getting book progress', { targetLanguage, bookId });

  try {
    const chapters = await Translation.getBookChapters(targetLanguage, bookId);
    const book = BIBLE_BOOKS.find(b => b.id === bookId);

    if (!book) {
      throw new Error(`Unknown book: ${bookId}`);
    }

    return {
      bookId,
      bookName: book.name,
      testament: book.testament,
      totalChapters: book.chapters,
      chapters: chapters.map(ch => ({
        chapter: ch.chapter,
        totalVerses: ch.totalVerses,
        translatedVerses: ch.translatedVerses,
        reviewedVerses: ch.reviewedVerses,
        percentComplete: ch.totalVerses > 0
          ? Math.round((ch.translatedVerses / ch.totalVerses) * 100)
          : 0
      }))
    };
  } catch (error) {
    logger.error('Failed to get book progress', { targetLanguage, bookId, error: error.message });
    throw error;
  }
}

/**
 * Submit a verse translation
 */
async function submitTranslation(options) {
  const { userId, targetLanguage, bookId, chapter, verse, sourceText, translatedText } = options;

  logger.debug('Submitting translation', { userId, targetLanguage, bookId, chapter, verse });

  try {
    // Validate language
    if (!isLanguageSupported(targetLanguage)) {
      throw new Error(`Unsupported language: ${targetLanguage}`);
    }

    // Validate book
    const book = BIBLE_BOOKS.find(b => b.id === bookId);
    if (!book) {
      throw new Error(`Unknown book: ${bookId}`);
    }

    // Create translation record
    const translation = await Translation.create({
      userId,
      targetLanguage,
      bookId,
      chapter,
      verse,
      sourceText,
      translatedText,
      status: 'pending_review'
    });

    logger.info('Translation submitted', { translationId: translation.id, bookId, chapter, verse });

    return translation;
  } catch (error) {
    logger.error('Failed to submit translation', { error: error.message });
    throw error;
  }
}

/**
 * Review a translation
 */
async function reviewTranslation(translationId, reviewerId, status, feedback = null) {
  logger.debug('Reviewing translation', { translationId, reviewerId, status });

  try {
    const translation = await Translation.findById(translationId);

    if (!translation) {
      throw new Error('Translation not found');
    }

    const updatedTranslation = await Translation.update(translationId, {
      status,
      reviewerId,
      reviewedAt: new Date(),
      reviewFeedback: feedback
    });

    logger.info('Translation reviewed', { translationId, status });

    return updatedTranslation;
  } catch (error) {
    logger.error('Failed to review translation', { translationId, error: error.message });
    throw error;
  }
}

/**
 * Get translations for a verse
 */
async function getVerseTranslations(bookId, chapter, verse, targetLanguage = null) {
  logger.debug('Getting verse translations', { bookId, chapter, verse, targetLanguage });

  try {
    const filters = { bookId, chapter, verse };
    if (targetLanguage) {
      filters.targetLanguage = targetLanguage;
    }

    return await Translation.findByVerse(filters);
  } catch (error) {
    logger.error('Failed to get verse translations', { error: error.message });
    throw error;
  }
}

/**
 * Detect language of text
 */
function detectLanguage(text) {
  if (!text || text.length < 10) {
    return { language: 'unknown', confidence: 0 };
  }

  // Simple heuristic-based detection (in production, use a proper library)
  const patterns = {
    hebrew: /[\u0590-\u05FF]/,
    greek: /[\u0370-\u03FF]/,
    arabic: /[\u0600-\u06FF]/,
    chinese: /[\u4E00-\u9FFF]/,
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
    korean: /[\uAC00-\uD7AF]/,
    russian: /[\u0400-\u04FF]/,
    spanish: /[áéíóúüñ¿¡]/i,
    french: /[àâäçéèêëïîôùûü]/i,
    german: /[äöüß]/i,
    portuguese: /[àáâãçéêíóôõú]/i
  };

  for (const [language, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return { language, confidence: 0.8 };
    }
  }

  // Default to English if Latin characters dominate
  if (/^[a-zA-Z\s\.,!?'"-]+$/.test(text.substring(0, 100))) {
    return { language: 'english', confidence: 0.7 };
  }

  return { language: 'unknown', confidence: 0 };
}

/**
 * Check if language is supported
 */
function isLanguageSupported(languageCode) {
  return SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode);
}

/**
 * Get supported languages list
 */
function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

/**
 * Get Bible books list
 */
function getBibleBooks(testament = null) {
  if (testament) {
    return BIBLE_BOOKS.filter(book => book.testament === testament);
  }
  return BIBLE_BOOKS;
}

/**
 * Get user's translation history
 */
async function getUserTranslationHistory(userId, options = {}) {
  const { limit = 50, offset = 0, status = null } = options;

  logger.debug('Getting user translation history', { userId, limit, offset });

  try {
    return await Translation.findByUser(userId, { limit, offset, status });
  } catch (error) {
    logger.error('Failed to get user translation history', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get recent translation activity
 */
async function getRecentActivity(options = {}) {
  const { limit = 20, targetLanguage = null } = options;

  logger.debug('Getting recent translation activity', { limit, targetLanguage });

  try {
    return await Translation.getRecentActivity({ limit, targetLanguage });
  } catch (error) {
    logger.error('Failed to get recent activity', { error: error.message });
    throw error;
  }
}

/**
 * Calculate translation statistics for dashboard
 */
async function getDashboardStats(userId = null) {
  logger.debug('Getting dashboard stats', { userId });

  try {
    const globalStats = await Translation.getGlobalStats();

    let userStats = null;
    if (userId) {
      userStats = await Translation.getUserStats(userId);
    }

    return {
      global: {
        totalTranslations: globalStats.totalTranslations || 0,
        totalContributors: globalStats.totalContributors || 0,
        languagesInProgress: globalStats.languagesInProgress || 0,
        versesTranslatedThisWeek: globalStats.versesThisWeek || 0
      },
      user: userStats ? {
        totalContributions: userStats.totalContributions || 0,
        approvedTranslations: userStats.approvedTranslations || 0,
        pendingReview: userStats.pendingReview || 0,
        rank: userStats.rank || null
      } : null
    };
  } catch (error) {
    logger.error('Failed to get dashboard stats', { error: error.message });
    throw error;
  }
}

/**
 * Get translated search placeholder for a persona and language
 * Format: "Ask [PersonaName] Anything..." translated to target language
 * PersonaName is transliterated (same script), NOT translated to equivalent names
 *
 * @param {string} personaSlug - Persona slug (e.g., 'jubilee', 'elias')
 * @param {string} targetLanguage - Target language code (e.g., 'es', 'fr', 'zh')
 * @returns {Promise<string>} Translated placeholder text
 */
async function getSearchPlaceholder(personaSlug, targetLanguage) {
  // If English, return the default immediately
  if (targetLanguage === 'en') {
    const personaName = personaSlug.charAt(0).toUpperCase() + personaSlug.slice(1);
    return `Ask ${personaName} Anything...`;
  }

  const stringKey = 'search_placeholder';
  const normalizedSlug = personaSlug.toLowerCase();
  const personaName = normalizedSlug.charAt(0).toUpperCase() + normalizedSlug.slice(1);
  const sourceText = `Ask ${personaName} Anything...`;

  logger.debug('Getting search placeholder translation', { personaSlug: normalizedSlug, targetLanguage });

  try {
    // First, check if we have a cached translation in the database
    const cachedTranslation = await Translation.getUITranslation(stringKey, normalizedSlug, targetLanguage);

    if (cachedTranslation) {
      logger.debug('Found cached UI translation', { personaSlug: normalizedSlug, targetLanguage });
      return cachedTranslation;
    }

    // Not in cache - translate using OpenAI
    const translatedText = await translatePlaceholderWithAI(personaName, targetLanguage);

    // Save to cache for future use
    await Translation.saveUITranslation(stringKey, normalizedSlug, targetLanguage, sourceText, translatedText);

    logger.info('Generated and cached UI translation', { personaSlug: normalizedSlug, targetLanguage });
    return translatedText;

  } catch (error) {
    logger.error('Failed to get search placeholder translation', {
      personaSlug: normalizedSlug,
      targetLanguage,
      error: error.message
    });
    // Fallback to English
    return sourceText;
  }
}

/**
 * Translate placeholder text using OpenAI with automatic fallback to backup key
 * Keeps the persona name as-is (transliterated if needed for script), not translated
 *
 * @param {string} personaName - The persona's name (e.g., 'Jubilee', 'Elias')
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Translated placeholder
 */
async function translatePlaceholderWithAI(personaName, targetLanguage) {
  const OpenAI = require('openai');
  const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  const prompt = `Translate this user interface placeholder text to ${languageName}:
"Ask ${personaName} Anything..."

IMPORTANT RULES:
1. "${personaName}" is a proper name and must NOT be translated to any equivalent name in the target language
2. If the target language uses a different script (e.g., Arabic, Chinese, Hebrew, Japanese, Korean, Russian, etc.), transliterate "${personaName}" to that script phonetically
3. Keep the same friendly, inviting tone
4. The "..." at the end should remain or be adapted to the target language convention

Return ONLY the translated text, nothing else.`;

  const messages = [
    { role: 'system', content: 'You are a professional translator. Translate UI text accurately while preserving proper names.' },
    { role: 'user', content: prompt }
  ];

  // Try primary API key first
  try {
    const openai = new OpenAI({ apiKey: config.ai.openaiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 100,
      temperature: 0.3
    });

    const translatedText = response.choices[0].message.content.trim();
    return translatedText.replace(/^["']|["']$/g, '');

  } catch (primaryError) {
    // Check if it's a quota/rate limit error (429) or auth error (401)
    const shouldFallback = primaryError.status === 429 || primaryError.status === 401 ||
                           primaryError.message?.includes('quota') ||
                           primaryError.message?.includes('rate limit');

    if (shouldFallback && config.ai.openaiKeyBackup) {
      logger.warn('Primary OpenAI key failed, trying backup key', {
        personaName,
        targetLanguage,
        error: primaryError.message
      });

      try {
        const openaiBackup = new OpenAI({ apiKey: config.ai.openaiKeyBackup });
        const response = await openaiBackup.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 100,
          temperature: 0.3
        });

        const translatedText = response.choices[0].message.content.trim();
        logger.info('Successfully used backup OpenAI key for translation');
        return translatedText.replace(/^["']|["']$/g, '');

      } catch (backupError) {
        logger.error('Backup OpenAI key also failed', {
          personaName,
          targetLanguage,
          error: backupError.message
        });
        throw backupError;
      }
    }

    logger.error('OpenAI translation failed', { personaName, targetLanguage, error: primaryError.message });
    throw primaryError;
  }
}

module.exports = {
  getTranslationProgress,
  getBookProgress,
  submitTranslation,
  reviewTranslation,
  getVerseTranslations,
  detectLanguage,
  isLanguageSupported,
  getSupportedLanguages,
  getBibleBooks,
  getUserTranslationHistory,
  getRecentActivity,
  getDashboardStats,
  getSearchPlaceholder
};
