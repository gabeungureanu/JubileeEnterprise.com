/**
 * Translation Controller
 * Handles Bible translation-related HTTP requests
 */

const { TranslationService, AuthService } = require('../services');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Get supported languages
 * GET /api/translation/languages
 */
const getLanguages = asyncHandler(async (req, res) => {
  const languages = TranslationService.getSupportedLanguages();

  res.json({
    success: true,
    languages
  });
});

/**
 * Get Bible books
 * GET /api/translation/books
 */
const getBooks = asyncHandler(async (req, res) => {
  const { testament } = req.query;

  const books = TranslationService.getBibleBooks(testament);

  res.json({
    success: true,
    books,
    count: books.length
  });
});

/**
 * Get translation progress for language
 * GET /api/translation/progress/:language
 */
const getProgress = asyncHandler(async (req, res) => {
  const { language } = req.params;

  if (!TranslationService.isLanguageSupported(language)) {
    throw new AppError('Unsupported language', 400);
  }

  const progress = await TranslationService.getTranslationProgress(language);

  res.json({
    success: true,
    progress
  });
});

/**
 * Get book translation progress
 * GET /api/translation/progress/:language/:bookId
 */
const getBookProgress = asyncHandler(async (req, res) => {
  const { language, bookId } = req.params;

  if (!TranslationService.isLanguageSupported(language)) {
    throw new AppError('Unsupported language', 400);
  }

  const progress = await TranslationService.getBookProgress(language, bookId);

  res.json({
    success: true,
    progress
  });
});

/**
 * Submit a translation
 * POST /api/translation/submit
 */
const submitTranslation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { targetLanguage, bookId, chapter, verse, sourceText, translatedText } = req.body;

  // Validation
  if (!targetLanguage || !bookId || !chapter || !verse || !sourceText || !translatedText) {
    throw new AppError('All fields are required', 400);
  }

  const translation = await TranslationService.submitTranslation({
    userId: req.session.userId,
    targetLanguage,
    bookId,
    chapter: parseInt(chapter),
    verse: parseInt(verse),
    sourceText,
    translatedText
  });

  res.status(201).json({
    success: true,
    message: 'Translation submitted for review',
    translation
  });
});

/**
 * Review a translation
 * POST /api/translation/:id/review
 */
const reviewTranslation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  // Check if user has reviewer role
  const user = await AuthService.getUserById(req.session.userId);
  if (!AuthService.hasRole(user, 'reviewer')) {
    throw new AppError('Insufficient permissions', 403);
  }

  const { id } = req.params;
  const { status, feedback } = req.body;

  if (!['approved', 'rejected', 'needs_revision'].includes(status)) {
    throw new AppError('Invalid review status', 400);
  }

  const translation = await TranslationService.reviewTranslation(
    id,
    req.session.userId,
    status,
    feedback
  );

  res.json({
    success: true,
    message: 'Translation reviewed',
    translation
  });
});

/**
 * Get translations for a verse
 * GET /api/translation/verse/:bookId/:chapter/:verse
 */
const getVerseTranslations = asyncHandler(async (req, res) => {
  const { bookId, chapter, verse } = req.params;
  const { language } = req.query;

  const translations = await TranslationService.getVerseTranslations(
    bookId,
    parseInt(chapter),
    parseInt(verse),
    language
  );

  res.json({
    success: true,
    verse: { bookId, chapter: parseInt(chapter), verse: parseInt(verse) },
    translations
  });
});

/**
 * Get user's translation history
 * GET /api/translation/history
 */
const getUserHistory = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { limit, offset, status } = req.query;

  const translations = await TranslationService.getUserTranslationHistory(
    req.session.userId,
    {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      status
    }
  );

  res.json({
    success: true,
    translations,
    pagination: {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    }
  });
});

/**
 * Get recent translation activity
 * GET /api/translation/activity
 */
const getRecentActivity = asyncHandler(async (req, res) => {
  const { limit, language } = req.query;

  const activity = await TranslationService.getRecentActivity({
    limit: parseInt(limit) || 20,
    targetLanguage: language
  });

  res.json({
    success: true,
    activity
  });
});

/**
 * Get dashboard statistics
 * GET /api/translation/stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.session.userId || null;

  const stats = await TranslationService.getDashboardStats(userId);

  res.json({
    success: true,
    stats
  });
});

/**
 * Detect language of text
 * POST /api/translation/detect
 */
const detectLanguage = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text) {
    throw new AppError('Text is required', 400);
  }

  const result = TranslationService.detectLanguage(text);

  res.json({
    success: true,
    detection: result
  });
});

/**
 * Get translated search placeholder for persona
 * GET /api/translation/placeholder
 */
const getSearchPlaceholder = asyncHandler(async (req, res) => {
  const { persona, language } = req.query;

  if (!persona) {
    throw new AppError('Persona is required', 400);
  }

  const targetLanguage = language || 'en';
  const placeholder = await TranslationService.getSearchPlaceholder(persona, targetLanguage);

  res.json({
    success: true,
    placeholder,
    persona,
    language: targetLanguage
  });
});

module.exports = {
  getLanguages,
  getBooks,
  getProgress,
  getBookProgress,
  submitTranslation,
  reviewTranslation,
  getVerseTranslations,
  getUserHistory,
  getRecentActivity,
  getDashboardStats,
  detectLanguage,
  getSearchPlaceholder
};
