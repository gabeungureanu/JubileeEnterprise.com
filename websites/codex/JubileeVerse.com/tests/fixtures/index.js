/**
 * Test Fixtures
 * Static test data for consistent testing
 */

/**
 * Sample users for testing
 */
const users = {
  validUser: {
    email: 'valid@test.com',
    password: 'ValidPass123!',
    displayName: 'Valid User',
    preferredLanguage: 'en'
  },
  adminUser: {
    email: 'admin@test.com',
    password: 'AdminPass123!',
    displayName: 'Admin User',
    preferredLanguage: 'en',
    role: 'admin'
  },
  reviewerUser: {
    email: 'reviewer@test.com',
    password: 'ReviewPass123!',
    displayName: 'Reviewer User',
    preferredLanguage: 'en',
    role: 'reviewer'
  }
};

/**
 * Sample personas for testing
 */
const personas = {
  scholar: {
    id: 'persona-scholar-1',
    name: 'Dr. Samuel',
    slug: 'dr-samuel',
    title: 'Biblical Scholar',
    category: 'scholar',
    description: 'Expert in Old Testament studies',
    expertise: ['Old Testament', 'Hebrew'],
    languages: ['en', 'he'],
    isActive: true
  },
  prayerPartner: {
    id: 'persona-prayer-1',
    name: 'Sister Grace',
    slug: 'sister-grace',
    title: 'Prayer Partner',
    category: 'prayer',
    description: 'Compassionate guide for prayer',
    expertise: ['Intercessory Prayer', 'Spiritual Guidance'],
    languages: ['en', 'es'],
    isActive: true
  },
  inactivePersona: {
    id: 'persona-inactive-1',
    name: 'Inactive Persona',
    slug: 'inactive-persona',
    title: 'Test',
    category: 'test',
    description: 'Inactive for testing',
    expertise: [],
    languages: ['en'],
    isActive: false
  }
};

/**
 * Sample messages for testing
 */
const messages = {
  userMessage: {
    type: 'user',
    content: 'What is the meaning of Jubilee in the Bible?'
  },
  assistantMessage: {
    type: 'assistant',
    content: 'The Jubilee year, described in Leviticus 25, was a remarkable institution...'
  },
  longMessage: {
    type: 'user',
    content: 'A'.repeat(5000) // Long message for testing limits
  },
  emptyMessage: {
    type: 'user',
    content: ''
  }
};

/**
 * Sample translations for testing
 */
const translations = {
  genesis1_1: {
    bookId: 'genesis',
    chapter: 1,
    verse: 1,
    sourceText: 'In the beginning God created the heavens and the earth.',
    targetLanguage: 'es',
    translatedText: 'En el principio Dios creó los cielos y la tierra.'
  },
  john1_1: {
    bookId: 'john',
    chapter: 1,
    verse: 1,
    sourceText: 'In the beginning was the Word, and the Word was with God, and the Word was God.',
    targetLanguage: 'fr',
    translatedText: 'Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était Dieu.'
  }
};

/**
 * Sample Bible books subset for testing
 */
const bibleBooks = [
  { id: 'genesis', name: 'Genesis', testament: 'old', chapters: 50 },
  { id: 'exodus', name: 'Exodus', testament: 'old', chapters: 40 },
  { id: 'matthew', name: 'Matthew', testament: 'new', chapters: 28 },
  { id: 'john', name: 'John', testament: 'new', chapters: 21 }
];

/**
 * Sample supported languages for testing
 */
const supportedLanguages = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' }
];

/**
 * Invalid inputs for negative testing
 */
const invalidInputs = {
  passwords: [
    '', // empty
    'short', // too short
    'nouppercase123', // no uppercase
    'NOLOWERCASE123', // no lowercase
    'NoNumbers!', // no numbers
  ],
  emails: [
    '', // empty
    'invalid', // no @ symbol
    'invalid@', // no domain
    '@nodomain.com', // no local part
    'spaces in@email.com' // spaces
  ]
};

/**
 * API response templates
 */
const apiResponses = {
  success: { success: true },
  unauthorized: { success: false, error: 'Not authenticated' },
  forbidden: { success: false, error: 'Insufficient permissions' },
  notFound: { success: false, error: 'Not found' },
  badRequest: { success: false, error: 'Bad request' }
};

module.exports = {
  users,
  personas,
  messages,
  translations,
  bibleBooks,
  supportedLanguages,
  invalidInputs,
  apiResponses
};
