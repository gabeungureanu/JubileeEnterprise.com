/**
 * Cache Service
 * High-level caching abstraction with TTL strategies
 */

const RedisClient = require('./RedisClient');
const logger = require('../utils/logger');

/**
 * Cache TTL strategies (in seconds)
 */
const TTL = {
  VERY_SHORT: 30,        // 30 seconds - rate limiting, session validation
  SHORT: 60,             // 1 minute - API responses, user data
  MEDIUM: 300,           // 5 minutes - persona lists, categories
  LONG: 3600,            // 1 hour - translation progress, static data
  VERY_LONG: 86400,      // 24 hours - Bible books, supported languages
  PERMANENT: 0           // No expiry (use sparingly)
};

/**
 * Cache key prefixes for namespacing
 */
const PREFIX = {
  SESSION: 'sess:',
  USER: 'user:',
  PERSONA: 'persona:',
  PERSONA_LIST: 'persona:list:',
  PERSONA_FEATURED: 'persona:featured',
  PERSONA_CATEGORIES: 'persona:categories',
  CONVERSATION: 'conv:',
  TRANSLATION: 'trans:',
  TRANSLATION_PROGRESS: 'trans:progress:',
  RATE_LIMIT: 'ratelimit:',
  API_RESPONSE: 'api:'
};

/**
 * Get value from cache
 */
async function get(key) {
  try {
    const client = RedisClient.getClient();
    const value = await client.get(key);

    if (value) {
      logger.debug('Cache hit', { key });
      return JSON.parse(value);
    }

    logger.debug('Cache miss', { key });
    return null;
  } catch (error) {
    logger.error('Cache get error', { key, error: error.message });
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
async function set(key, value, ttlSeconds = TTL.MEDIUM) {
  try {
    const client = RedisClient.getClient();
    const serialized = JSON.stringify(value);

    if (ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }

    logger.debug('Cache set', { key, ttl: ttlSeconds });
    return true;
  } catch (error) {
    logger.error('Cache set error', { key, error: error.message });
    return false;
  }
}

/**
 * Delete value from cache
 */
async function del(key) {
  try {
    const client = RedisClient.getClient();
    await client.del(key);
    logger.debug('Cache delete', { key });
    return true;
  } catch (error) {
    logger.error('Cache delete error', { key, error: error.message });
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
async function delPattern(pattern) {
  try {
    const client = RedisClient.getClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
      logger.debug('Cache pattern delete', { pattern, count: keys.length });
    }

    return keys.length;
  } catch (error) {
    logger.error('Cache pattern delete error', { pattern, error: error.message });
    return 0;
  }
}

/**
 * Get or set with callback (cache-aside pattern)
 */
async function getOrSet(key, fetchFn, ttlSeconds = TTL.MEDIUM) {
  try {
    // Try cache first
    const cached = await get(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const freshData = await fetchFn();

    // Cache the result
    if (freshData !== null && freshData !== undefined) {
      await set(key, freshData, ttlSeconds);
    }

    return freshData;
  } catch (error) {
    logger.error('Cache getOrSet error', { key, error: error.message });
    // Fall back to fetch function on cache error
    return fetchFn();
  }
}

/**
 * Check if key exists in cache
 */
async function exists(key) {
  try {
    const client = RedisClient.getClient();
    return await client.exists(key) > 0;
  } catch (error) {
    logger.error('Cache exists error', { key, error: error.message });
    return false;
  }
}

/**
 * Get remaining TTL for a key
 */
async function ttl(key) {
  try {
    const client = RedisClient.getClient();
    return await client.ttl(key);
  } catch (error) {
    logger.error('Cache ttl error', { key, error: error.message });
    return -1;
  }
}

/**
 * Increment a counter
 */
async function incr(key, ttlSeconds = null) {
  try {
    const client = RedisClient.getClient();
    const value = await client.incr(key);

    if (ttlSeconds && value === 1) {
      await client.expire(key, ttlSeconds);
    }

    return value;
  } catch (error) {
    logger.error('Cache incr error', { key, error: error.message });
    return 0;
  }
}

/**
 * Get multiple values
 */
async function mget(keys) {
  try {
    const client = RedisClient.getClient();
    const values = await client.mget(...keys);

    return values.map(v => v ? JSON.parse(v) : null);
  } catch (error) {
    logger.error('Cache mget error', { error: error.message });
    return keys.map(() => null);
  }
}

/**
 * Set multiple values
 */
async function mset(keyValuePairs, ttlSeconds = TTL.MEDIUM) {
  try {
    const client = RedisClient.getClient();
    const args = [];

    for (const [key, value] of Object.entries(keyValuePairs)) {
      args.push(key, JSON.stringify(value));
    }

    await client.mset(...args);

    // Set TTL for each key
    if (ttlSeconds > 0) {
      for (const key of Object.keys(keyValuePairs)) {
        await client.expire(key, ttlSeconds);
      }
    }

    return true;
  } catch (error) {
    logger.error('Cache mset error', { error: error.message });
    return false;
  }
}

// ============================================
// Domain-specific cache helpers
// ============================================

/**
 * Cache persona by ID
 */
async function cachePersona(persona) {
  const key = `${PREFIX.PERSONA}${persona.id}`;
  return set(key, persona, TTL.LONG);
}

/**
 * Get cached persona by ID
 */
async function getCachedPersona(personaId) {
  const key = `${PREFIX.PERSONA}${personaId}`;
  return get(key);
}

/**
 * Cache persona list
 */
async function cachePersonaList(filters, personas) {
  const filterKey = JSON.stringify(filters);
  const key = `${PREFIX.PERSONA_LIST}${Buffer.from(filterKey).toString('base64')}`;
  return set(key, personas, TTL.MEDIUM);
}

/**
 * Get cached persona list
 */
async function getCachedPersonaList(filters) {
  const filterKey = JSON.stringify(filters);
  const key = `${PREFIX.PERSONA_LIST}${Buffer.from(filterKey).toString('base64')}`;
  return get(key);
}

/**
 * Cache featured personas
 */
async function cacheFeaturedPersonas(personas) {
  return set(PREFIX.PERSONA_FEATURED, personas, TTL.MEDIUM);
}

/**
 * Get cached featured personas
 */
async function getCachedFeaturedPersonas() {
  return get(PREFIX.PERSONA_FEATURED);
}

/**
 * Invalidate all persona caches
 */
async function invalidatePersonaCache() {
  await delPattern(`${PREFIX.PERSONA}*`);
  await del(PREFIX.PERSONA_FEATURED);
}

/**
 * Cache user by ID
 */
async function cacheUser(user) {
  const key = `${PREFIX.USER}${user.id}`;
  return set(key, user, TTL.SHORT);
}

/**
 * Get cached user by ID
 */
async function getCachedUser(userId) {
  const key = `${PREFIX.USER}${userId}`;
  return get(key);
}

/**
 * Invalidate user cache
 */
async function invalidateUserCache(userId) {
  const key = `${PREFIX.USER}${userId}`;
  return del(key);
}

/**
 * Cache translation progress
 */
async function cacheTranslationProgress(language, progress) {
  const key = `${PREFIX.TRANSLATION_PROGRESS}${language}`;
  return set(key, progress, TTL.MEDIUM);
}

/**
 * Get cached translation progress
 */
async function getCachedTranslationProgress(language) {
  const key = `${PREFIX.TRANSLATION_PROGRESS}${language}`;
  return get(key);
}

/**
 * Invalidate translation progress cache
 */
async function invalidateTranslationProgress(language) {
  const key = `${PREFIX.TRANSLATION_PROGRESS}${language}`;
  return del(key);
}

/**
 * Rate limiting check
 */
async function checkRateLimit(identifier, limit, windowSeconds) {
  const key = `${PREFIX.RATE_LIMIT}${identifier}`;
  const current = await incr(key, windowSeconds);

  return {
    allowed: current <= limit,
    current,
    limit,
    remaining: Math.max(0, limit - current)
  };
}

module.exports = {
  // Core operations
  get,
  set,
  del,
  delPattern,
  getOrSet,
  exists,
  ttl,
  incr,
  mget,
  mset,

  // Constants
  TTL,
  PREFIX,

  // Persona caching
  cachePersona,
  getCachedPersona,
  cachePersonaList,
  getCachedPersonaList,
  cacheFeaturedPersonas,
  getCachedFeaturedPersonas,
  invalidatePersonaCache,

  // User caching
  cacheUser,
  getCachedUser,
  invalidateUserCache,

  // Translation caching
  cacheTranslationProgress,
  getCachedTranslationProgress,
  invalidateTranslationProgress,

  // Rate limiting
  checkRateLimit
};
