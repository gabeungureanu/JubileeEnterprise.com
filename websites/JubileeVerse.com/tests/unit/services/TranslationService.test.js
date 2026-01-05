/**
 * TranslationService Unit Tests
 * TDD tests for translation service
 */

const TranslationService = require('../../../src/services/TranslationService');
const { createMockTranslation, createMockUser } = require('../../mocks');
const { translations, bibleBooks, supportedLanguages } = require('../../fixtures');

// Mock the Translation model
jest.mock('../../../src/models/Translation', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByVerse: jest.fn(),
  findByUser: jest.fn(),
  update: jest.fn(),
  getLanguageStats: jest.fn(),
  getBookChapters: jest.fn(),
  getRecentActivity: jest.fn(),
  getGlobalStats: jest.fn(),
  getUserStats: jest.fn()
}));

const Translation = require('../../../src/models/Translation');

describe('TranslationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSupportedLanguages', () => {
    it('should return array of supported languages', () => {
      const languages = TranslationService.getSupportedLanguages();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages[0]).toHaveProperty('code');
      expect(languages[0]).toHaveProperty('name');
      expect(languages[0]).toHaveProperty('native');
    });

    it('should include English', () => {
      const languages = TranslationService.getSupportedLanguages();
      const english = languages.find(l => l.code === 'en');

      expect(english).toBeDefined();
      expect(english.name).toBe('English');
    });

    it('should include Hebrew and Greek', () => {
      const languages = TranslationService.getSupportedLanguages();
      const hebrew = languages.find(l => l.code === 'he');
      const greek = languages.find(l => l.code === 'el');

      expect(hebrew).toBeDefined();
      expect(greek).toBeDefined();
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported language', () => {
      expect(TranslationService.isLanguageSupported('en')).toBe(true);
      expect(TranslationService.isLanguageSupported('es')).toBe(true);
      expect(TranslationService.isLanguageSupported('he')).toBe(true);
    });

    it('should return false for unsupported language', () => {
      expect(TranslationService.isLanguageSupported('xx')).toBe(false);
      expect(TranslationService.isLanguageSupported('invalid')).toBe(false);
      expect(TranslationService.isLanguageSupported('')).toBe(false);
    });
  });

  describe('getBibleBooks', () => {
    it('should return all 66 Bible books when no filter', () => {
      const books = TranslationService.getBibleBooks();

      expect(Array.isArray(books)).toBe(true);
      expect(books.length).toBe(66);
    });

    it('should return only Old Testament books', () => {
      const books = TranslationService.getBibleBooks('old');

      expect(books.every(b => b.testament === 'old')).toBe(true);
      expect(books.length).toBe(39);
    });

    it('should return only New Testament books', () => {
      const books = TranslationService.getBibleBooks('new');

      expect(books.every(b => b.testament === 'new')).toBe(true);
      expect(books.length).toBe(27);
    });

    it('should include Genesis as first Old Testament book', () => {
      const books = TranslationService.getBibleBooks('old');
      expect(books[0].id).toBe('genesis');
      expect(books[0].chapters).toBe(50);
    });

    it('should include Matthew as first New Testament book', () => {
      const books = TranslationService.getBibleBooks('new');
      expect(books[0].id).toBe('matthew');
      expect(books[0].chapters).toBe(28);
    });
  });

  describe('detectLanguage', () => {
    it('should detect Hebrew text', () => {
      const result = TranslationService.detectLanguage('בְּרֵאשִׁית בָּרָא אֱלֹהִים');
      expect(result.language).toBe('hebrew');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Greek text', () => {
      const result = TranslationService.detectLanguage('Ἐν ἀρχῇ ἦν ὁ λόγος');
      expect(result.language).toBe('greek');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Arabic text', () => {
      const result = TranslationService.detectLanguage('في البدء خلق الله السماوات');
      expect(result.language).toBe('arabic');
    });

    it('should detect Chinese text', () => {
      const result = TranslationService.detectLanguage('起初神创造天地');
      expect(result.language).toBe('chinese');
    });

    it('should detect English text', () => {
      const result = TranslationService.detectLanguage('In the beginning God created the heavens and the earth');
      expect(result.language).toBe('english');
    });

    it('should return unknown for very short text', () => {
      const result = TranslationService.detectLanguage('Hi');
      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should return unknown for empty text', () => {
      const result = TranslationService.detectLanguage('');
      expect(result.language).toBe('unknown');
    });
  });

  describe('getTranslationProgress', () => {
    it('should return progress statistics for language', async () => {
      Translation.getLanguageStats.mockResolvedValue({
        completedBooks: 10,
        totalVerses: 31102,
        translatedVerses: 5000,
        reviewedVerses: 3000
      });

      const progress = await TranslationService.getTranslationProgress('es');

      expect(progress.language).toBe('es');
      expect(progress.totalBooks).toBe(66);
      expect(progress.completedBooks).toBe(10);
      expect(progress.percentComplete).toBeDefined();
      expect(progress.percentReviewed).toBeDefined();
    });

    it('should calculate percentages correctly', async () => {
      Translation.getLanguageStats.mockResolvedValue({
        completedBooks: 0,
        totalVerses: 100,
        translatedVerses: 50,
        reviewedVerses: 25
      });

      const progress = await TranslationService.getTranslationProgress('es');

      expect(progress.percentComplete).toBe(50);
      expect(progress.percentReviewed).toBe(50);
    });

    it('should handle zero verses', async () => {
      Translation.getLanguageStats.mockResolvedValue({
        completedBooks: 0,
        totalVerses: 0,
        translatedVerses: 0,
        reviewedVerses: 0
      });

      const progress = await TranslationService.getTranslationProgress('es');

      expect(progress.percentComplete).toBe(0);
      expect(progress.percentReviewed).toBe(0);
    });
  });

  describe('submitTranslation', () => {
    it('should submit valid translation', async () => {
      const translationData = {
        userId: 'user-123',
        ...translations.genesis1_1
      };

      const mockCreated = createMockTranslation(translationData);
      Translation.create.mockResolvedValue(mockCreated);

      const result = await TranslationService.submitTranslation(translationData);

      expect(result).toBeDefined();
      expect(result.status).toBe('pending_review');
      expect(Translation.create).toHaveBeenCalled();
    });

    it('should reject unsupported target language', async () => {
      const translationData = {
        userId: 'user-123',
        targetLanguage: 'invalid',
        bookId: 'genesis',
        chapter: 1,
        verse: 1,
        sourceText: 'Test',
        translatedText: 'Test'
      };

      await expect(TranslationService.submitTranslation(translationData))
        .rejects.toThrow('Unsupported language');
    });

    it('should reject unknown book', async () => {
      const translationData = {
        userId: 'user-123',
        targetLanguage: 'es',
        bookId: 'invalid-book',
        chapter: 1,
        verse: 1,
        sourceText: 'Test',
        translatedText: 'Test'
      };

      await expect(TranslationService.submitTranslation(translationData))
        .rejects.toThrow('Unknown book');
    });
  });

  describe('reviewTranslation', () => {
    it('should approve translation', async () => {
      const mockTranslation = createMockTranslation();
      Translation.findById.mockResolvedValue(mockTranslation);
      Translation.update.mockResolvedValue({
        ...mockTranslation,
        status: 'approved'
      });

      const result = await TranslationService.reviewTranslation(
        mockTranslation.id,
        'reviewer-123',
        'approved',
        'Good translation'
      );

      expect(Translation.update).toHaveBeenCalledWith(
        mockTranslation.id,
        expect.objectContaining({
          status: 'approved',
          reviewerId: 'reviewer-123',
          reviewFeedback: 'Good translation'
        })
      );
    });

    it('should reject non-existent translation', async () => {
      Translation.findById.mockResolvedValue(null);

      await expect(TranslationService.reviewTranslation(
        'non-existent',
        'reviewer-123',
        'approved'
      )).rejects.toThrow('Translation not found');
    });
  });

  describe('getVerseTranslations', () => {
    it('should return translations for specific verse', async () => {
      const mockTranslations = [
        createMockTranslation({ targetLanguage: 'es' }),
        createMockTranslation({ targetLanguage: 'fr' })
      ];
      Translation.findByVerse.mockResolvedValue(mockTranslations);

      const result = await TranslationService.getVerseTranslations('genesis', 1, 1);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should filter by target language', async () => {
      const mockTranslations = [createMockTranslation({ targetLanguage: 'es' })];
      Translation.findByVerse.mockResolvedValue(mockTranslations);

      await TranslationService.getVerseTranslations('genesis', 1, 1, 'es');

      expect(Translation.findByVerse).toHaveBeenCalledWith({
        bookId: 'genesis',
        chapter: 1,
        verse: 1,
        targetLanguage: 'es'
      });
    });
  });

  describe('getUserTranslationHistory', () => {
    it('should return paginated user history', async () => {
      const mockTranslations = [
        createMockTranslation(),
        createMockTranslation()
      ];
      Translation.findByUser.mockResolvedValue(mockTranslations);

      const result = await TranslationService.getUserTranslationHistory('user-123', {
        limit: 20,
        offset: 0
      });

      expect(Array.isArray(result)).toBe(true);
      expect(Translation.findByUser).toHaveBeenCalledWith('user-123', {
        limit: 20,
        offset: 0,
        status: null
      });
    });

    it('should filter by status', async () => {
      Translation.findByUser.mockResolvedValue([]);

      await TranslationService.getUserTranslationHistory('user-123', {
        status: 'approved'
      });

      expect(Translation.findByUser).toHaveBeenCalledWith('user-123', expect.objectContaining({
        status: 'approved'
      }));
    });
  });

  describe('getDashboardStats', () => {
    it('should return global stats without user', async () => {
      Translation.getGlobalStats.mockResolvedValue({
        totalTranslations: 10000,
        totalContributors: 500,
        languagesInProgress: 12,
        versesThisWeek: 150
      });

      const result = await TranslationService.getDashboardStats();

      expect(result.global).toBeDefined();
      expect(result.global.totalTranslations).toBe(10000);
      expect(result.user).toBeNull();
    });

    it('should include user stats when userId provided', async () => {
      Translation.getGlobalStats.mockResolvedValue({
        totalTranslations: 10000,
        totalContributors: 500,
        languagesInProgress: 12,
        versesThisWeek: 150
      });
      Translation.getUserStats.mockResolvedValue({
        totalContributions: 50,
        approvedTranslations: 40,
        pendingReview: 10,
        rank: 15
      });

      const result = await TranslationService.getDashboardStats('user-123');

      expect(result.global).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.totalContributions).toBe(50);
      expect(result.user.rank).toBe(15);
    });
  });
});
