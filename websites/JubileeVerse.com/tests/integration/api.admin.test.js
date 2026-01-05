/**
 * Admin API Integration Tests
 * Tests admin endpoints for queue management and system health
 */

const request = require('supertest');
const createApp = require('../../src/app');

// Mock dependencies
jest.mock('../../src/database', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  shutdown: jest.fn().mockResolvedValue(true),
  isConnected: jest.fn().mockReturnValue(true),
  getPostgres: jest.fn(),
  getQdrant: jest.fn()
}));

jest.mock('../../src/cache', () => ({
  RedisClient: {
    initialize: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockReturnValue(true),
    isMock: jest.fn().mockReturnValue(true),
    getClient: jest.fn().mockReturnValue({})
  },
  CacheService: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn().mockResolvedValue(5)
  }
}));

// Mock queue services
jest.mock('../../src/queue', () => ({
  QueueManager: {
    QUEUE_NAMES: {
      AI_RESPONSE: 'ai-response',
      EMAIL: 'email',
      ANALYTICS: 'analytics'
    },
    getQueue: jest.fn().mockReturnValue({
      _isMock: true,
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getCompletedCount: jest.fn().mockResolvedValue(100),
      getFailedCount: jest.fn().mockResolvedValue(2),
      getDelayedCount: jest.fn().mockResolvedValue(0)
    }),
    getQueueStats: jest.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
      delayed: 0
    }),
    getAllQueueStats: jest.fn().mockResolvedValue({
      'ai-response': { waiting: 5, active: 2, completed: 100, failed: 3, delayed: 0 },
      'email': { waiting: 0, active: 0, completed: 50, failed: 0, delayed: 0 }
    }),
    pauseQueue: jest.fn().mockResolvedValue(undefined),
    resumeQueue: jest.fn().mockResolvedValue(undefined),
    cleanQueue: jest.fn().mockResolvedValue(10)
  },
  WebSocketService: {
    initialize: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      totalConnections: 42,
      uniqueUsers: 35,
      connectionsByUser: {}
    }),
    broadcast: jest.fn().mockReturnValue(42),
    shutdown: jest.fn().mockResolvedValue(undefined)
  },
  AIResponseProcessor: {
    initializeWorker: jest.fn(),
    queueAIResponse: jest.fn()
  }
}));

describe('Admin API Integration', () => {
  let app;
  let adminAgent;
  let userAgent;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    adminAgent = request.agent(app);
    userAgent = request.agent(app);
  });

  // Helper to simulate admin session
  const simulateAdminSession = (agent) => {
    // In real tests, you'd authenticate. Here we'll mock session for controller tests
  };

  describe('GET /api/admin/health', () => {
    it('should return system health status (public endpoint)', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('version');
    });

    it('should include Redis status', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .expect(200);

      expect(response.body).toHaveProperty('redis');
      expect(response.body.redis).toHaveProperty('connected');
    });

    it('should include WebSocket status', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .expect(200);

      expect(response.body).toHaveProperty('websocket');
    });
  });

  describe('GET /api/admin/queues (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/queues')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/queues/:name (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/queues/ai-response')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/queues/:name/pause (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/queues/ai-response/pause')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/queues/:name/resume (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/queues/ai-response/resume')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/queues/:name/clean (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/queues/ai-response/clean')
        .send({ grace: 3600000, status: 'completed' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/websocket (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/websocket')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/cache (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/cache')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/admin/cache (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/admin/cache')
        .send({ pattern: 'personas:*' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/broadcast (protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/broadcast')
        .send({ message: 'Test broadcast', type: 'admin-notice' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
