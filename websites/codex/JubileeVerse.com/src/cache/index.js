/**
 * Cache Module Index
 * Exports caching functionality
 */

const RedisClient = require('./RedisClient');
const CacheService = require('./CacheService');

module.exports = {
  RedisClient,
  CacheService,

  // Convenience re-exports
  initialize: RedisClient.initialize,
  shutdown: RedisClient.shutdown,
  getClient: RedisClient.getClient,

  // TTL constants
  TTL: CacheService.TTL,
  PREFIX: CacheService.PREFIX
};
