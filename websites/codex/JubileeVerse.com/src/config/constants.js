/**
 * Application constants for JubileeVerse
 */

module.exports = {
  // Supported languages for Bible translations
  SUPPORTED_LANGUAGES: [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
    { code: 'zh', name: 'Chinese', native: '中文' },
    { code: 'ja', name: 'Japanese', native: '日本語' },
    { code: 'ko', name: 'Korean', native: '한국어' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'he', name: 'Hebrew', native: 'עברית' },
    { code: 'el', name: 'Greek', native: 'Ελληνικά' },
    { code: 'ru', name: 'Russian', native: 'Русский' }
  ],

  // Default persona categories
  PERSONA_CATEGORIES: [
    'biblical-scholars',
    'spiritual-guides',
    'prayer-partners',
    'bible-teachers',
    'worship-leaders',
    'counselors'
  ],

  // Chat message types
  MESSAGE_TYPES: {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
    TRANSLATION: 'translation'
  },

  // AI Provider identifiers
  AI_PROVIDERS: {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic'
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100
  },

  // Bible translation tracking statuses
  TRANSLATION_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    REVIEWED: 'reviewed'
  },

  // Bible books for translation tracking
  BIBLE_BOOKS: [
    // Old Testament
    { id: 'genesis', name: 'Genesis', testament: 'old', chapters: 50 },
    { id: 'exodus', name: 'Exodus', testament: 'old', chapters: 40 },
    { id: 'leviticus', name: 'Leviticus', testament: 'old', chapters: 27 },
    { id: 'numbers', name: 'Numbers', testament: 'old', chapters: 36 },
    { id: 'deuteronomy', name: 'Deuteronomy', testament: 'old', chapters: 34 },
    { id: 'joshua', name: 'Joshua', testament: 'old', chapters: 24 },
    { id: 'judges', name: 'Judges', testament: 'old', chapters: 21 },
    { id: 'ruth', name: 'Ruth', testament: 'old', chapters: 4 },
    { id: '1samuel', name: '1 Samuel', testament: 'old', chapters: 31 },
    { id: '2samuel', name: '2 Samuel', testament: 'old', chapters: 24 },
    { id: '1kings', name: '1 Kings', testament: 'old', chapters: 22 },
    { id: '2kings', name: '2 Kings', testament: 'old', chapters: 25 },
    { id: '1chronicles', name: '1 Chronicles', testament: 'old', chapters: 29 },
    { id: '2chronicles', name: '2 Chronicles', testament: 'old', chapters: 36 },
    { id: 'ezra', name: 'Ezra', testament: 'old', chapters: 10 },
    { id: 'nehemiah', name: 'Nehemiah', testament: 'old', chapters: 13 },
    { id: 'esther', name: 'Esther', testament: 'old', chapters: 10 },
    { id: 'job', name: 'Job', testament: 'old', chapters: 42 },
    { id: 'psalms', name: 'Psalms', testament: 'old', chapters: 150 },
    { id: 'proverbs', name: 'Proverbs', testament: 'old', chapters: 31 },
    { id: 'ecclesiastes', name: 'Ecclesiastes', testament: 'old', chapters: 12 },
    { id: 'songofsolomon', name: 'Song of Solomon', testament: 'old', chapters: 8 },
    { id: 'isaiah', name: 'Isaiah', testament: 'old', chapters: 66 },
    { id: 'jeremiah', name: 'Jeremiah', testament: 'old', chapters: 52 },
    { id: 'lamentations', name: 'Lamentations', testament: 'old', chapters: 5 },
    { id: 'ezekiel', name: 'Ezekiel', testament: 'old', chapters: 48 },
    { id: 'daniel', name: 'Daniel', testament: 'old', chapters: 12 },
    { id: 'hosea', name: 'Hosea', testament: 'old', chapters: 14 },
    { id: 'joel', name: 'Joel', testament: 'old', chapters: 3 },
    { id: 'amos', name: 'Amos', testament: 'old', chapters: 9 },
    { id: 'obadiah', name: 'Obadiah', testament: 'old', chapters: 1 },
    { id: 'jonah', name: 'Jonah', testament: 'old', chapters: 4 },
    { id: 'micah', name: 'Micah', testament: 'old', chapters: 7 },
    { id: 'nahum', name: 'Nahum', testament: 'old', chapters: 3 },
    { id: 'habakkuk', name: 'Habakkuk', testament: 'old', chapters: 3 },
    { id: 'zephaniah', name: 'Zephaniah', testament: 'old', chapters: 3 },
    { id: 'haggai', name: 'Haggai', testament: 'old', chapters: 2 },
    { id: 'zechariah', name: 'Zechariah', testament: 'old', chapters: 14 },
    { id: 'malachi', name: 'Malachi', testament: 'old', chapters: 4 },
    // New Testament
    { id: 'matthew', name: 'Matthew', testament: 'new', chapters: 28 },
    { id: 'mark', name: 'Mark', testament: 'new', chapters: 16 },
    { id: 'luke', name: 'Luke', testament: 'new', chapters: 24 },
    { id: 'john', name: 'John', testament: 'new', chapters: 21 },
    { id: 'acts', name: 'Acts', testament: 'new', chapters: 28 },
    { id: 'romans', name: 'Romans', testament: 'new', chapters: 16 },
    { id: '1corinthians', name: '1 Corinthians', testament: 'new', chapters: 16 },
    { id: '2corinthians', name: '2 Corinthians', testament: 'new', chapters: 13 },
    { id: 'galatians', name: 'Galatians', testament: 'new', chapters: 6 },
    { id: 'ephesians', name: 'Ephesians', testament: 'new', chapters: 6 },
    { id: 'philippians', name: 'Philippians', testament: 'new', chapters: 4 },
    { id: 'colossians', name: 'Colossians', testament: 'new', chapters: 4 },
    { id: '1thessalonians', name: '1 Thessalonians', testament: 'new', chapters: 5 },
    { id: '2thessalonians', name: '2 Thessalonians', testament: 'new', chapters: 3 },
    { id: '1timothy', name: '1 Timothy', testament: 'new', chapters: 6 },
    { id: '2timothy', name: '2 Timothy', testament: 'new', chapters: 4 },
    { id: 'titus', name: 'Titus', testament: 'new', chapters: 3 },
    { id: 'philemon', name: 'Philemon', testament: 'new', chapters: 1 },
    { id: 'hebrews', name: 'Hebrews', testament: 'new', chapters: 13 },
    { id: 'james', name: 'James', testament: 'new', chapters: 5 },
    { id: '1peter', name: '1 Peter', testament: 'new', chapters: 5 },
    { id: '2peter', name: '2 Peter', testament: 'new', chapters: 3 },
    { id: '1john', name: '1 John', testament: 'new', chapters: 5 },
    { id: '2john', name: '2 John', testament: 'new', chapters: 1 },
    { id: '3john', name: '3 John', testament: 'new', chapters: 1 },
    { id: 'jude', name: 'Jude', testament: 'new', chapters: 1 },
    { id: 'revelation', name: 'Revelation', testament: 'new', chapters: 22 }
  ]
};
