/**
 * Redis Client
 * Manages Redis connection with fallback for development
 */

const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let client = null;
let isConnected = false;
let useMock = false;

/**
 * Mock Redis client for development without Redis
 */
class MockRedis {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
    logger.info('Using mock Redis client (development mode)');
  }

  async get(key) {
    this._checkExpiry(key);
    const value = this.store.get(key);
    return value || null;
  }

  async set(key, value, ...args) {
    this.store.set(key, value);

    // Handle EX (seconds) or PX (milliseconds) options
    if (args.length >= 2) {
      const [option, ttl] = args;
      if (option === 'EX') {
        this.ttls.set(key, Date.now() + (ttl * 1000));
      } else if (option === 'PX') {
        this.ttls.set(key, Date.now() + ttl);
      }
    }
    return 'OK';
  }

  async setex(key, seconds, value) {
    this.store.set(key, value);
    this.ttls.set(key, Date.now() + (seconds * 1000));
    return 'OK';
  }

  async del(...keys) {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted++;
        this.ttls.delete(key);
      }
    }
    return deleted;
  }

  async exists(...keys) {
    let count = 0;
    for (const key of keys) {
      this._checkExpiry(key);
      if (this.store.has(key)) count++;
    }
    return count;
  }

  async expire(key, seconds) {
    if (!this.store.has(key)) return 0;
    this.ttls.set(key, Date.now() + (seconds * 1000));
    return 1;
  }

  async ttl(key) {
    this._checkExpiry(key);
    const expiry = this.ttls.get(key);
    if (!expiry) return -1;
    const remaining = Math.ceil((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async incr(key) {
    this._checkExpiry(key);
    const value = parseInt(this.store.get(key) || '0', 10);
    this.store.set(key, String(value + 1));
    return value + 1;
  }

  async decr(key) {
    this._checkExpiry(key);
    const value = parseInt(this.store.get(key) || '0', 10);
    this.store.set(key, String(value - 1));
    return value - 1;
  }

  async mget(...keys) {
    return keys.map(key => {
      this._checkExpiry(key);
      return this.store.get(key) || null;
    });
  }

  async mset(...args) {
    for (let i = 0; i < args.length; i += 2) {
      this.store.set(args[i], args[i + 1]);
    }
    return 'OK';
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const result = [];
    for (const key of this.store.keys()) {
      this._checkExpiry(key);
      if (regex.test(key) && this.store.has(key)) {
        result.push(key);
      }
    }
    return result;
  }

  async hset(key, field, value) {
    let hash = this.store.get(key);
    if (!hash || typeof hash !== 'object') {
      hash = {};
    }
    hash[field] = value;
    this.store.set(key, hash);
    return 1;
  }

  async hget(key, field) {
    const hash = this.store.get(key);
    if (!hash || typeof hash !== 'object') return null;
    return hash[field] || null;
  }

  async hgetall(key) {
    return this.store.get(key) || {};
  }

  async hdel(key, ...fields) {
    const hash = this.store.get(key);
    if (!hash || typeof hash !== 'object') return 0;
    let deleted = 0;
    for (const field of fields) {
      if (field in hash) {
        delete hash[field];
        deleted++;
      }
    }
    return deleted;
  }

  async flushall() {
    this.store.clear();
    this.ttls.clear();
    return 'OK';
  }

  async quit() {
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  on(event, callback) {
    if (event === 'connect' || event === 'ready') {
      setImmediate(callback);
    }
    return this;
  }

  _checkExpiry(key) {
    const expiry = this.ttls.get(key);
    if (expiry && Date.now() > expiry) {
      this.store.delete(key);
      this.ttls.delete(key);
    }
  }
}

/**
 * Initialize Redis connection
 */
async function initialize() {
  if (client) return client;

  const redisUrl = config.redis?.url || process.env.REDIS_URL;

  // Use mock in development if no Redis URL
  if (!redisUrl || config.server.isDev) {
    useMock = true;
    client = new MockRedis();
    isConnected = true;
    return client;
  }

  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 100,
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 5000,
      // Reconnection strategy
      retryStrategy(times) {
        if (times > 10) {
          logger.error('Redis: Max reconnection attempts reached');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      }
    });

    client.on('connect', () => {
      logger.info('Redis: Connected');
      isConnected = true;
    });

    client.on('ready', () => {
      logger.info('Redis: Ready');
    });

    client.on('error', (err) => {
      logger.error('Redis: Error', { error: err.message });
      isConnected = false;
    });

    client.on('close', () => {
      logger.info('Redis: Connection closed');
      isConnected = false;
    });

    // Test connection
    await client.ping();
    logger.info('Redis: Connection verified');

    return client;
  } catch (error) {
    logger.error('Redis: Failed to connect, falling back to mock', { error: error.message });
    useMock = true;
    client = new MockRedis();
    isConnected = true;
    return client;
  }
}

/**
 * Get Redis client instance
 */
function getClient() {
  if (!client) {
    throw new Error('Redis client not initialized. Call initialize() first.');
  }
  return client;
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
  return isConnected;
}

/**
 * Check if using mock client
 */
function isMockClient() {
  return useMock;
}

/**
 * Shutdown Redis connection
 */
async function shutdown() {
  if (client) {
    logger.info('Redis: Shutting down');
    await client.quit();
    client = null;
    isConnected = false;
  }
}

module.exports = {
  initialize,
  getClient,
  isConnected: isRedisConnected,
  isMock: isMockClient,
  shutdown,
  MockRedis
};
