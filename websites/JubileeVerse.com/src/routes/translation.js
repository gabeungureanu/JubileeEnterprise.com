/**
 * Translation routes
 * Delegates to TranslationController and PageController for request handling
 */

const express = require('express');
const router = express.Router();
const { TranslationController, PageController } = require('../controllers');
const { requireAuth } = require('../middleware');

// Page route
router.get('/', requireAuth, PageController.translation);

// Language and book reference data
router.get('/languages', TranslationController.getLanguages);
router.get('/books', TranslationController.getBooks);

// Translation progress
router.get('/progress/:language', TranslationController.getProgress);
router.get('/progress/:language/:bookId', TranslationController.getBookProgress);

// Translation submission and review
router.post('/submit', requireAuth, TranslationController.submitTranslation);
router.post('/:id/review', requireAuth, TranslationController.reviewTranslation);

// Verse translations
router.get('/verse/:bookId/:chapter/:verse', TranslationController.getVerseTranslations);

// User history and activity
router.get('/history', requireAuth, TranslationController.getUserHistory);
router.get('/activity', TranslationController.getRecentActivity);

// Statistics
router.get('/stats', TranslationController.getDashboardStats);

// Language detection
router.post('/detect', TranslationController.detectLanguage);

// UI translations
router.get('/placeholder', TranslationController.getSearchPlaceholder);

module.exports = router;
