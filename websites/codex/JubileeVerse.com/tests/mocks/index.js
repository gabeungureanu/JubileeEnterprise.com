/**
 * Test Mocks Index
 * Centralized mock factories for testing
 */

const { v4: uuidv4 } = require('uuid');

/**
 * User mock factory
 */
const createMockUser = (overrides = {}) => ({
  id: uuidv4(),
  email: `user-${Date.now()}@test.com`,
  displayName: 'Test User',
  passwordHash: 'hashed-password',
  preferredLanguage: 'en',
  role: 'user',
  isActive: true,
  emailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

/**
 * Persona mock factory
 */
const createMockPersona = (overrides = {}) => ({
  id: uuidv4(),
  name: 'Dr. Samuel',
  slug: 'dr-samuel',
  title: 'Biblical Scholar',
  category: 'scholar',
  description: 'Expert in Old Testament studies and ancient Hebrew texts',
  personality: 'Warm, encouraging, and deeply knowledgeable',
  expertise: ['Old Testament', 'Hebrew', 'Ancient History'],
  languages: ['en', 'he', 'el'],
  avatar: '/images/personas/scholar.svg',
  isActive: true,
  isFeatured: true,
  communicationStyle: {
    tone: 'scholarly yet accessible',
    approach: 'encouraging and supportive'
  },
  scriptureEmphasis: ['Torah', 'Psalms', 'Prophets'],
  conversationStarters: [
    'What is the significance of the Jubilee year?',
    'Can you explain the Hebrew meaning of Shalom?'
  ],
  temperature: 0.7,
  createdAt: new Date().toISOString(),
  ...overrides
});

/**
 * Conversation mock factory
 */
const createMockConversation = (overrides = {}) => ({
  id: uuidv4(),
  userId: uuidv4(),
  personaId: uuidv4(),
  title: 'Test Conversation',
  language: 'en',
  status: 'active',
  messageCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastMessageAt: new Date().toISOString(),
  ...overrides
});

/**
 * Message mock factory
 */
const createMockMessage = (overrides = {}) => ({
  id: uuidv4(),
  conversationId: uuidv4(),
  type: 'user',
  content: 'Test message content',
  metadata: {},
  createdAt: new Date().toISOString(),
  ...overrides
});

/**
 * Translation mock factory
 */
const createMockTranslation = (overrides = {}) => ({
  id: uuidv4(),
  userId: uuidv4(),
  targetLanguage: 'es',
  bookId: 'genesis',
  chapter: 1,
  verse: 1,
  sourceText: 'In the beginning God created the heavens and the earth.',
  translatedText: 'En el principio Dios creó los cielos y la tierra.',
  status: 'pending_review',
  reviewerId: null,
  reviewedAt: null,
  reviewFeedback: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

/**
 * Session mock factory
 */
const createMockSession = (overrides = {}) => ({
  userId: uuidv4(),
  user: createMockUser(),
  destroy: jest.fn((cb) => cb && cb()),
  save: jest.fn((cb) => cb && cb()),
  regenerate: jest.fn((cb) => cb && cb()),
  ...overrides
});

/**
 * Database mock factory
 */
const createMockDatabase = () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  initialize: jest.fn().mockResolvedValue(true),
  shutdown: jest.fn().mockResolvedValue(true),
  isConnected: jest.fn().mockReturnValue(true)
});

/**
 * Redis mock factory
 */
const createMockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  setex: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  mget: jest.fn(),
  mset: jest.fn(),
  exists: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(true)
});

/**
 * AI Service mock factory
 */
const createMockAIService = () => ({
  generateResponse: jest.fn().mockResolvedValue('Mock AI response'),
  estimateTokens: jest.fn().mockReturnValue(100),
  isProviderAvailable: jest.fn().mockReturnValue(true),
  getDefaultProvider: jest.fn().mockReturnValue('anthropic')
});

/**
 * Express app mock for supertest
 */
const createMockApp = () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  return app;
};

module.exports = {
  createMockUser,
  createMockPersona,
  createMockConversation,
  createMockMessage,
  createMockTranslation,
  createMockSession,
  createMockDatabase,
  createMockRedis,
  createMockAIService,
  createMockApp
};
