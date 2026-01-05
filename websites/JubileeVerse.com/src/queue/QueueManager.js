/**
 * Queue Manager
 * Manages BullMQ queues for background job processing
 */

const { Queue, Worker, QueueEvents } = require('bullmq');
const { RedisClient } = require('../cache');
const config = require('../config');
const logger = require('../utils/logger');

// Queue instances
const queues = new Map();
const workers = new Map();
const queueEvents = new Map();

// Queue names
const QUEUE_NAMES = {
  AI_RESPONSE: 'ai-response',
  EMAIL: 'email',
  ANALYTICS: 'analytics',
  TRANSLATION_REVIEW: 'translation-review'
};

// Default job options
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600 // 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600 // 7 days
  }
};

// Priority levels
const PRIORITY = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10
};

/**
 * Get Redis connection options for BullMQ
 */
function getConnectionOptions() {
  const redisConfig = config.redis;

  // If using mock Redis in development, return null
  if (RedisClient.isMock()) {
    return null;
  }

  return {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password || undefined,
    db: redisConfig.db
  };
}

/**
 * Create or get a queue
 */
function getQueue(name) {
  if (queues.has(name)) {
    return queues.get(name);
  }

  const connection = getConnectionOptions();

  // In development without Redis, use a mock queue
  if (!connection) {
    logger.warn(`Queue ${name}: Using mock queue (no Redis)`);
    return createMockQueue(name);
  }

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS
  });

  queue.on('error', (error) => {
    logger.error(`Queue ${name} error`, { error: error.message });
  });

  queues.set(name, queue);
  logger.info(`Queue ${name}: Created`);

  return queue;
}

/**
 * Create a worker for a queue
 */
function createWorker(name, processor, options = {}) {
  const connection = getConnectionOptions();

  if (!connection) {
    logger.warn(`Worker ${name}: Using mock worker (no Redis)`);
    return createMockWorker(name, processor);
  }

  const workerOptions = {
    connection,
    concurrency: options.concurrency || 5,
    limiter: options.limiter || {
      max: 100,
      duration: 1000
    },
    ...options
  };

  const worker = new Worker(name, processor, workerOptions);

  worker.on('completed', (job, result) => {
    logger.debug(`Job ${job.id} completed`, { queue: name, result: typeof result });
  });

  worker.on('failed', (job, error) => {
    logger.error(`Job ${job.id} failed`, {
      queue: name,
      error: error.message,
      attempts: job.attemptsMade
    });
  });

  worker.on('error', (error) => {
    logger.error(`Worker ${name} error`, { error: error.message });
  });

  workers.set(name, worker);
  logger.info(`Worker ${name}: Created with concurrency ${workerOptions.concurrency}`);

  return worker;
}

/**
 * Get queue events for monitoring
 */
function getQueueEvents(name) {
  if (queueEvents.has(name)) {
    return queueEvents.get(name);
  }

  const connection = getConnectionOptions();

  if (!connection) {
    return null;
  }

  const events = new QueueEvents(name, { connection });

  queueEvents.set(name, events);

  return events;
}

/**
 * Add a job to a queue
 */
async function addJob(queueName, jobName, data, options = {}) {
  const queue = getQueue(queueName);

  const jobOptions = {
    ...DEFAULT_JOB_OPTIONS,
    priority: options.priority || PRIORITY.NORMAL,
    delay: options.delay || 0,
    jobId: options.jobId,
    ...options
  };

  const job = await queue.add(jobName, data, jobOptions);

  logger.debug(`Job added to ${queueName}`, {
    jobId: job.id,
    name: jobName,
    priority: jobOptions.priority
  });

  return job;
}

/**
 * Get queue statistics
 */
async function getQueueStats(queueName) {
  const queue = getQueue(queueName);

  if (queue._isMock) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get all queues statistics
 */
async function getAllQueueStats() {
  const stats = {};

  for (const name of Object.values(QUEUE_NAMES)) {
    try {
      stats[name] = await getQueueStats(name);
    } catch (error) {
      stats[name] = { error: error.message };
    }
  }

  return stats;
}

/**
 * Pause a queue
 */
async function pauseQueue(queueName) {
  const queue = getQueue(queueName);
  if (!queue._isMock) {
    await queue.pause();
    logger.info(`Queue ${queueName}: Paused`);
  }
}

/**
 * Resume a queue
 */
async function resumeQueue(queueName) {
  const queue = getQueue(queueName);
  if (!queue._isMock) {
    await queue.resume();
    logger.info(`Queue ${queueName}: Resumed`);
  }
}

/**
 * Clean old jobs from a queue
 */
async function cleanQueue(queueName, grace = 3600000, status = 'completed') {
  const queue = getQueue(queueName);
  if (!queue._isMock) {
    const cleaned = await queue.clean(grace, 1000, status);
    logger.info(`Queue ${queueName}: Cleaned ${cleaned.length} ${status} jobs`);
    return cleaned.length;
  }
  return 0;
}

/**
 * Shutdown all queues and workers
 */
async function shutdown() {
  logger.info('Queue Manager: Shutting down');

  // Close all workers first
  for (const [name, worker] of workers) {
    try {
      await worker.close();
      logger.debug(`Worker ${name}: Closed`);
    } catch (error) {
      logger.error(`Worker ${name}: Close error`, { error: error.message });
    }
  }

  // Close all queue events
  for (const [name, events] of queueEvents) {
    try {
      await events.close();
    } catch (error) {
      logger.error(`QueueEvents ${name}: Close error`, { error: error.message });
    }
  }

  // Close all queues
  for (const [name, queue] of queues) {
    try {
      if (!queue._isMock) {
        await queue.close();
      }
      logger.debug(`Queue ${name}: Closed`);
    } catch (error) {
      logger.error(`Queue ${name}: Close error`, { error: error.message });
    }
  }

  workers.clear();
  queueEvents.clear();
  queues.clear();

  logger.info('Queue Manager: Shutdown complete');
}

// ============================================
// Mock implementations for development
// ============================================

/**
 * Create mock queue for development without Redis
 */
function createMockQueue(name) {
  const mockQueue = {
    _isMock: true,
    name,
    jobs: new Map(),
    jobCounter: 0,

    async add(jobName, data, options = {}) {
      const jobId = options.jobId || `mock-${++this.jobCounter}`;
      const job = {
        id: jobId,
        name: jobName,
        data,
        opts: options,
        attemptsMade: 0,
        timestamp: Date.now()
      };
      this.jobs.set(jobId, job);

      // Simulate async processing
      setImmediate(() => {
        this.processJob(job);
      });

      return job;
    },

    async processJob(job) {
      // Jobs are processed immediately in mock mode
      const processor = mockProcessors.get(name);
      if (processor) {
        try {
          await processor(job);
          this.jobs.delete(job.id);
        } catch (error) {
          job.attemptsMade++;
          logger.error(`Mock job ${job.id} failed`, { error: error.message });
        }
      }
    },

    async getWaitingCount() { return 0; },
    async getActiveCount() { return 0; },
    async getCompletedCount() { return this.jobCounter; },
    async getFailedCount() { return 0; },
    async getDelayedCount() { return 0; },
    async pause() {},
    async resume() {},
    async clean() { return []; },
    async close() {},
    on() {}
  };

  queues.set(name, mockQueue);
  return mockQueue;
}

// Store mock processors
const mockProcessors = new Map();

/**
 * Create mock worker for development
 */
function createMockWorker(name, processor) {
  mockProcessors.set(name, processor);

  const mockWorker = {
    _isMock: true,
    name,
    async close() {
      mockProcessors.delete(name);
    },
    on() {}
  };

  workers.set(name, mockWorker);
  return mockWorker;
}

module.exports = {
  QUEUE_NAMES,
  PRIORITY,
  getQueue,
  createWorker,
  getQueueEvents,
  addJob,
  getQueueStats,
  getAllQueueStats,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  shutdown
};
