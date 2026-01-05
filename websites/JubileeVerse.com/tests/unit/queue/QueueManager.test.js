/**
 * QueueManager Tests
 */

const { mockRedisClient, mockLogger } = require('../../mocks');

// Mock dependencies before requiring QueueManager
jest.mock('../../../src/cache', () => ({
  RedisClient: {
    isMock: jest.fn().mockReturnValue(true),
    getClient: jest.fn().mockReturnValue(mockRedisClient)
  }
}));

jest.mock('../../../src/utils/logger', () => mockLogger);

const QueueManager = require('../../../src/queue/QueueManager');

describe('QueueManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('QUEUE_NAMES', () => {
    it('should define all required queue names', () => {
      expect(QueueManager.QUEUE_NAMES).toHaveProperty('AI_RESPONSE');
      expect(QueueManager.QUEUE_NAMES).toHaveProperty('EMAIL');
      expect(QueueManager.QUEUE_NAMES).toHaveProperty('ANALYTICS');
      expect(QueueManager.QUEUE_NAMES).toHaveProperty('TRANSLATION_REVIEW');
    });
  });

  describe('PRIORITY', () => {
    it('should define priority levels in correct order', () => {
      expect(QueueManager.PRIORITY.HIGH).toBeLessThan(QueueManager.PRIORITY.NORMAL);
      expect(QueueManager.PRIORITY.NORMAL).toBeLessThan(QueueManager.PRIORITY.LOW);
    });

    it('should have HIGH priority as 1', () => {
      expect(QueueManager.PRIORITY.HIGH).toBe(1);
    });
  });

  describe('getQueue', () => {
    it('should return a mock queue when Redis is mocked', () => {
      const queue = QueueManager.getQueue('test-queue');

      expect(queue).toBeDefined();
      expect(queue._isMock).toBe(true);
      expect(queue.name).toBe('test-queue');
    });

    it('should return the same queue instance on subsequent calls', () => {
      const queue1 = QueueManager.getQueue('cached-queue');
      const queue2 = QueueManager.getQueue('cached-queue');

      expect(queue1).toBe(queue2);
    });

    it('should have required queue methods', () => {
      const queue = QueueManager.getQueue('methods-queue');

      expect(typeof queue.add).toBe('function');
      expect(typeof queue.getWaitingCount).toBe('function');
      expect(typeof queue.getActiveCount).toBe('function');
      expect(typeof queue.pause).toBe('function');
      expect(typeof queue.resume).toBe('function');
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const job = await QueueManager.addJob(
        'test-queue',
        'test-job',
        { message: 'test data' }
      );

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-job');
      expect(job.data).toEqual({ message: 'test data' });
    });

    it('should accept custom job ID', async () => {
      const customId = 'custom-job-123';
      const job = await QueueManager.addJob(
        'test-queue',
        'test-job',
        { data: 'test' },
        { jobId: customId }
      );

      expect(job.id).toBe(customId);
    });

    it('should accept priority option', async () => {
      const job = await QueueManager.addJob(
        'test-queue',
        'priority-job',
        { data: 'urgent' },
        { priority: QueueManager.PRIORITY.HIGH }
      );

      expect(job.opts.priority).toBe(QueueManager.PRIORITY.HIGH);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await QueueManager.getQueueStats('stats-queue');

      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('delayed');
    });

    it('should return zero counts for mock queue', async () => {
      const stats = await QueueManager.getQueueStats('empty-queue');

      expect(stats.waiting).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.delayed).toBe(0);
    });
  });

  describe('getAllQueueStats', () => {
    it('should return stats for all defined queues', async () => {
      const allStats = await QueueManager.getAllQueueStats();

      expect(allStats).toHaveProperty(QueueManager.QUEUE_NAMES.AI_RESPONSE);
      expect(allStats).toHaveProperty(QueueManager.QUEUE_NAMES.EMAIL);
      expect(allStats).toHaveProperty(QueueManager.QUEUE_NAMES.ANALYTICS);
    });
  });

  describe('pauseQueue / resumeQueue', () => {
    it('should pause a queue without error', async () => {
      await expect(
        QueueManager.pauseQueue('pause-queue')
      ).resolves.not.toThrow();
    });

    it('should resume a queue without error', async () => {
      await expect(
        QueueManager.resumeQueue('resume-queue')
      ).resolves.not.toThrow();
    });
  });

  describe('cleanQueue', () => {
    it('should clean jobs from queue', async () => {
      const cleaned = await QueueManager.cleanQueue('clean-queue', 3600000, 'completed');

      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createWorker', () => {
    it('should create a mock worker when Redis is mocked', () => {
      const processor = jest.fn();
      const worker = QueueManager.createWorker('worker-queue', processor);

      expect(worker).toBeDefined();
      expect(worker._isMock).toBe(true);
      expect(worker.name).toBe('worker-queue');
    });

    it('should have close method', () => {
      const processor = jest.fn();
      const worker = QueueManager.createWorker('closeable-queue', processor);

      expect(typeof worker.close).toBe('function');
    });
  });

  describe('shutdown', () => {
    it('should shutdown without error', async () => {
      await expect(QueueManager.shutdown()).resolves.not.toThrow();
    });
  });
});
