/**
 * AIResponseProcessor Tests
 */

const { mockLogger } = require('../../mocks');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => mockLogger);

jest.mock('../../../src/cache', () => ({
  RedisClient: {
    isMock: jest.fn().mockReturnValue(true),
    getClient: jest.fn()
  }
}));

// Mock services
const mockPersonaResponse = {
  response: 'Test AI response',
  persona: { id: 'test-persona', name: 'Test Persona' },
  contextUsed: 5
};

const mockAssistantMessage = {
  id: 'msg-123',
  type: 'assistant',
  content: 'Test AI response',
  createdAt: new Date()
};

jest.mock('../../../src/services', () => ({
  PersonaService: {
    generatePersonaResponse: jest.fn().mockResolvedValue(mockPersonaResponse)
  },
  ConversationService: {
    addMessage: jest.fn().mockResolvedValue(mockAssistantMessage)
  }
}));

// Mock WebSocketService
jest.mock('../../../src/queue/WebSocketService', () => ({
  sendToUser: jest.fn().mockReturnValue(1)
}));

const AIResponseProcessor = require('../../../src/queue/AIResponseProcessor');
const WebSocketService = require('../../../src/queue/WebSocketService');
const { PersonaService, ConversationService } = require('../../../src/services');

describe('AIResponseProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JOB_TYPES', () => {
    it('should define job types', () => {
      expect(AIResponseProcessor.JOB_TYPES).toHaveProperty('GENERATE_RESPONSE');
      expect(AIResponseProcessor.JOB_TYPES).toHaveProperty('STREAM_RESPONSE');
    });
  });

  describe('queueAIResponse', () => {
    it('should queue an AI response job', async () => {
      const data = {
        conversationId: 'conv-123',
        personaId: 'persona-456',
        messages: [{ role: 'user', content: 'Hello' }],
        userLanguage: 'en',
        userId: 'user-789'
      };

      const result = await AIResponseProcessor.queueAIResponse(data);

      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('requestId');
      expect(result).toHaveProperty('status', 'queued');
    });

    it('should accept custom requestId', async () => {
      const customRequestId = 'custom-request-123';
      const data = {
        conversationId: 'conv-123',
        personaId: 'persona-456',
        messages: [],
        userLanguage: 'en',
        userId: 'user-789'
      };

      const result = await AIResponseProcessor.queueAIResponse(data, {
        requestId: customRequestId
      });

      expect(result.requestId).toBe(customRequestId);
    });

    it('should accept priority option', async () => {
      const data = {
        conversationId: 'conv-123',
        personaId: 'persona-456',
        messages: [],
        userLanguage: 'en',
        userId: 'user-789'
      };

      const result = await AIResponseProcessor.queueAIResponse(data, {
        priority: 1 // HIGH
      });

      expect(result).toHaveProperty('status', 'queued');
    });
  });

  describe('getJobStatus', () => {
    it('should return status for mock queue', async () => {
      const status = await AIResponseProcessor.getJobStatus('mock-request-123');

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('requestId', 'mock-request-123');
    });
  });

  describe('cancelJob', () => {
    it('should return mock mode result for mock queue', async () => {
      const result = await AIResponseProcessor.cancelJob('mock-job-123');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reason');
    });
  });

  describe('initializeWorker', () => {
    it('should initialize worker with default options', () => {
      const worker = AIResponseProcessor.initializeWorker();

      expect(worker).toBeDefined();
      expect(worker._isMock).toBe(true);
    });

    it('should accept custom concurrency', () => {
      const worker = AIResponseProcessor.initializeWorker({
        concurrency: 20,
        rateLimit: 100
      });

      expect(worker).toBeDefined();
    });
  });
});
