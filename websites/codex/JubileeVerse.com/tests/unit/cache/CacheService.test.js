/**
 * CacheService Unit Tests
 * TDD tests for caching functionality
 */

const { MockRedis } = require('../../../src/cache/RedisClient');

// Mock RedisClient before requiring CacheService
jest.mock('../../../src/cache/RedisClient', () => {
  const mockClient = new (require('../../../src/cache/RedisClient').MockRedis)();
  return {
    initialize: jest.fn().mockResolvedValue(mockClient),
    getClient: jest.fn(() => mockClient),
    isConnected: jest.fn().mockReturnValue(true),
    isMock: jest.fn().mockReturnValue(true),
    shutdown: jest.fn().mockResolvedValue(true),
    MockRedis: require('../../../src/cache/RedisClient').MockRedis
  };
});

const CacheService = require('../../../src/cache/CacheService');
const RedisClient = require('../../../src/cache/RedisClient');

describe('CacheService', () => {
  let mockClient;

  beforeEach(async () => {
    // Reset mock client before each test
    mockClient = RedisClient.getClient();
    await mockClient.flushall();
  });

  describe('TTL Constants', () => {
    it('should have correct TTL values', () => {
      expect(CacheService.TTL.VERY_SHORT).toBe(30);
      expect(CacheService.TTL.SHORT).toBe(60);
      expect(CacheService.TTL.MEDIUM).toBe(300);
      expect(CacheService.TTL.LONG).toBe(3600);
      expect(CacheService.TTL.VERY_LONG).toBe(86400);
      expect(CacheService.TTL.PERMANENT).toBe(0);
    });
  });

  describe('PREFIX Constants', () => {
    it('should have required prefixes', () => {
      expect(CacheService.PREFIX.SESSION).toBeDefined();
      expect(CacheService.PREFIX.USER).toBeDefined();
      expect(CacheService.PREFIX.PERSONA).toBeDefined();
      expect(CacheService.PREFIX.CONVERSATION).toBeDefined();
      expect(CacheService.PREFIX.TRANSLATION).toBeDefined();
      expect(CacheService.PREFIX.RATE_LIMIT).toBeDefined();
    });
  });

  describe('get and set', () => {
    it('should set and get a value', async () => {
      const key = 'test:key';
      const value = { foo: 'bar', num: 123 };

      await CacheService.set(key, value);
      const result = await CacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await CacheService.get('nonexistent:key');
      expect(result).toBeNull();
    });

    it('should handle complex objects', async () => {
      const key = 'test:complex';
      const value = {
        name: 'Test',
        nested: { a: 1, b: [1, 2, 3] },
        array: ['one', 'two'],
        date: '2024-01-01T00:00:00.000Z'
      };

      await CacheService.set(key, value);
      const result = await CacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should set with custom TTL', async () => {
      const key = 'test:ttl';
      const value = 'test value';

      await CacheService.set(key, value, 60);

      const ttl = await CacheService.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      const key = 'test:delete';
      await CacheService.set(key, 'value');

      await CacheService.del(key);

      const result = await CacheService.get(key);
      expect(result).toBeNull();
    });

    it('should handle deleting non-existent key', async () => {
      const result = await CacheService.del('nonexistent');
      expect(result).toBe(true);
    });
  });

  describe('delPattern', () => {
    it('should delete keys matching pattern', async () => {
      await CacheService.set('prefix:one', 'value1');
      await CacheService.set('prefix:two', 'value2');
      await CacheService.set('other:key', 'value3');

      const deleted = await CacheService.delPattern('prefix:*');

      expect(deleted).toBe(2);
      expect(await CacheService.get('prefix:one')).toBeNull();
      expect(await CacheService.get('prefix:two')).toBeNull();
      expect(await CacheService.get('other:key')).toEqual('value3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const key = 'test:getorset';
      const cachedValue = { cached: true };

      await CacheService.set(key, cachedValue);

      const fetchFn = jest.fn().mockResolvedValue({ fresh: true });
      const result = await CacheService.getOrSet(key, fetchFn);

      expect(result).toEqual(cachedValue);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not exists', async () => {
      const key = 'test:getorset:new';
      const freshValue = { fresh: true };

      const fetchFn = jest.fn().mockResolvedValue(freshValue);
      const result = await CacheService.getOrSet(key, fetchFn);

      expect(result).toEqual(freshValue);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Verify it was cached
      const cached = await CacheService.get(key);
      expect(cached).toEqual(freshValue);
    });

    it('should use custom TTL', async () => {
      const key = 'test:getorset:ttl';
      const fetchFn = jest.fn().mockResolvedValue('value');

      await CacheService.getOrSet(key, fetchFn, 120);

      const ttl = await CacheService.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(120);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await CacheService.set('test:exists', 'value');

      const result = await CacheService.exists('test:exists');
      expect(result).toBe(true);
    });

    it('should return false for non-existing key', async () => {
      const result = await CacheService.exists('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('incr', () => {
    it('should increment a counter', async () => {
      const key = 'test:counter';

      const val1 = await CacheService.incr(key);
      const val2 = await CacheService.incr(key);
      const val3 = await CacheService.incr(key);

      expect(val1).toBe(1);
      expect(val2).toBe(2);
      expect(val3).toBe(3);
    });

    it('should set TTL on first increment', async () => {
      const key = 'test:counter:ttl';

      await CacheService.incr(key, 60);

      const ttl = await CacheService.ttl(key);
      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe('mget and mset', () => {
    it('should get multiple values', async () => {
      await CacheService.set('multi:1', 'value1');
      await CacheService.set('multi:2', 'value2');

      const results = await CacheService.mget(['multi:1', 'multi:2', 'multi:3']);

      expect(results).toEqual(['value1', 'value2', null]);
    });

    it('should set multiple values', async () => {
      await CacheService.mset({
        'mset:1': 'value1',
        'mset:2': 'value2',
        'mset:3': { complex: true }
      });

      expect(await CacheService.get('mset:1')).toBe('value1');
      expect(await CacheService.get('mset:2')).toBe('value2');
      expect(await CacheService.get('mset:3')).toEqual({ complex: true });
    });
  });

  describe('Persona caching helpers', () => {
    const mockPersona = {
      id: 'persona-123',
      name: 'Dr. Samuel',
      category: 'scholar'
    };

    it('should cache and retrieve persona', async () => {
      await CacheService.cachePersona(mockPersona);

      const cached = await CacheService.getCachedPersona(mockPersona.id);

      expect(cached).toEqual(mockPersona);
    });

    it('should return null for non-cached persona', async () => {
      const cached = await CacheService.getCachedPersona('nonexistent');
      expect(cached).toBeNull();
    });

    it('should cache and retrieve persona list', async () => {
      const personas = [mockPersona, { id: 'persona-456', name: 'Sister Grace' }];
      const filters = { category: 'scholar' };

      await CacheService.cachePersonaList(filters, personas);

      const cached = await CacheService.getCachedPersonaList(filters);

      expect(cached).toEqual(personas);
    });

    it('should cache and retrieve featured personas', async () => {
      const featured = [mockPersona];

      await CacheService.cacheFeaturedPersonas(featured);

      const cached = await CacheService.getCachedFeaturedPersonas();

      expect(cached).toEqual(featured);
    });

    it('should invalidate persona cache', async () => {
      await CacheService.cachePersona(mockPersona);
      await CacheService.cacheFeaturedPersonas([mockPersona]);

      await CacheService.invalidatePersonaCache();

      expect(await CacheService.getCachedPersona(mockPersona.id)).toBeNull();
      expect(await CacheService.getCachedFeaturedPersonas()).toBeNull();
    });
  });

  describe('User caching helpers', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@test.com',
      displayName: 'Test User'
    };

    it('should cache and retrieve user', async () => {
      await CacheService.cacheUser(mockUser);

      const cached = await CacheService.getCachedUser(mockUser.id);

      expect(cached).toEqual(mockUser);
    });

    it('should invalidate user cache', async () => {
      await CacheService.cacheUser(mockUser);

      await CacheService.invalidateUserCache(mockUser.id);

      expect(await CacheService.getCachedUser(mockUser.id)).toBeNull();
    });
  });

  describe('Translation caching helpers', () => {
    it('should cache and retrieve translation progress', async () => {
      const progress = {
        language: 'es',
        percentComplete: 45,
        translatedVerses: 14000
      };

      await CacheService.cacheTranslationProgress('es', progress);

      const cached = await CacheService.getCachedTranslationProgress('es');

      expect(cached).toEqual(progress);
    });

    it('should invalidate translation progress cache', async () => {
      await CacheService.cacheTranslationProgress('es', { percentComplete: 45 });

      await CacheService.invalidateTranslationProgress('es');

      expect(await CacheService.getCachedTranslationProgress('es')).toBeNull();
    });
  });

  describe('Rate limiting', () => {
    it('should allow requests within limit', async () => {
      const identifier = 'user:123';
      const limit = 5;
      const window = 60;

      const result1 = await CacheService.checkRateLimit(identifier, limit, window);
      const result2 = await CacheService.checkRateLimit(identifier, limit, window);

      expect(result1.allowed).toBe(true);
      expect(result1.current).toBe(1);
      expect(result1.remaining).toBe(4);

      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(2);
      expect(result2.remaining).toBe(3);
    });

    it('should block requests exceeding limit', async () => {
      const identifier = 'user:456';
      const limit = 2;
      const window = 60;

      await CacheService.checkRateLimit(identifier, limit, window);
      await CacheService.checkRateLimit(identifier, limit, window);
      const result = await CacheService.checkRateLimit(identifier, limit, window);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.remaining).toBe(0);
    });
  });
});
