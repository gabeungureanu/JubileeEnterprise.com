/**
 * Central configuration module for JubileeVerse
 * Loads and validates environment variables
 */

require('dotenv').config();

const config = {
  // Server settings
  server: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost',
    isDev: process.env.NODE_ENV !== 'production'
  },

  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'JubileeVerse',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },

  // Qdrant vector database
  qdrant: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT, 10) || 6333,
    collection: process.env.QDRANT_COLLECTION || 'inspire_knowledge',
    apiKey: process.env.QDRANT_API_KEY,
    maxStep: Number.isFinite(parseInt(process.env.QDRANT_MAX_STEP, 10))
      ? parseInt(process.env.QDRANT_MAX_STEP, 10)
      : 32,
    scoreThreshold: Number.isFinite(parseFloat(process.env.QDRANT_SCORE_THRESHOLD))
      ? parseFloat(process.env.QDRANT_SCORE_THRESHOLD)
      : 0.4,
    searchLimit: Number.isFinite(parseInt(process.env.QDRANT_SEARCH_LIMIT, 10))
      ? parseInt(process.env.QDRANT_SEARCH_LIMIT, 10)
      : 5,
    searchFallbackLimit: Number.isFinite(parseInt(process.env.QDRANT_SEARCH_FALLBACK_LIMIT, 10))
      ? parseInt(process.env.QDRANT_SEARCH_FALLBACK_LIMIT, 10)
      : 10
  },

  // AI services
  ai: {
    openaiKey: process.env.OPENAI_API_KEY_PRIMARY,
    openaiKeyBackup: process.env.OPENAI_API_KEY_BACKUP,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    grokKey: process.env.GROK_API_KEY,
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  },

  // Analytics
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
    id: process.env.ANALYTICS_ID
  },

  // Rate limiting (more permissive in development)
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || (process.env.NODE_ENV !== 'production' ? 60000 : 900000),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || (process.env.NODE_ENV !== 'production' ? 1000 : 100)
  },

  // CORS
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',')
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || null,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    // Build URL if not provided
    get connectionUrl() {
      if (this.url) return this.url;
      const auth = this.password ? `:${this.password}@` : '';
      return `redis://${auth}${this.host}:${this.port}/${this.db}`;
    }
  }
};

module.exports = config;
