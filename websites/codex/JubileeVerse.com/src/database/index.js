/**
 * Database Connection Manager
 * Centralizes all database connections (PostgreSQL, Qdrant)
 */

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * PostgreSQL connection pool
 */
let pgPool = null;

/**
 * Qdrant client for vector database operations
 */
const { QdrantClient } = require('@qdrant/js-client-rest');
let qdrantClient = null;

/**
 * Check if we should use mock mode
 */
const useMockMode = process.env.DB_MOCK === 'true' || process.env.NODE_ENV === 'test';

/**
 * Initialize PostgreSQL connection
 */
async function initPostgres() {
  try {
    if (useMockMode) {
      logger.info('PostgreSQL connection initialized (mock mode)');
      pgPool = {
        connected: true,
        mock: true,
        query: async () => ({ rows: [], rowCount: 0 }),
        end: async () => {}
      };
      return pgPool;
    }

    pgPool = new Pool({
      host: config.database.host || 'localhost',
      port: config.database.port || 5432,
      database: config.database.name || 'jubileeverse',
      user: config.database.user || 'postgres',
      password: config.database.password || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test the connection
    await pgPool.query('SELECT NOW()');

    logger.info('PostgreSQL connection initialized', {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name
    });

    // Handle pool errors
    pgPool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', { error: err.message });
    });

    return pgPool;
  } catch (error) {
    logger.error('PostgreSQL connection failed', { error: error.message });

    // Fall back to mock mode if connection fails in development
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Falling back to mock database mode');
      pgPool = {
        connected: true,
        mock: true,
        query: async () => ({ rows: [], rowCount: 0 }),
        end: async () => {}
      };
      return pgPool;
    }

    throw error;
  }
}

/**
 * Initialize Qdrant connection
 */
async function initQdrant() {
  try {
    // Check if Qdrant should be in mock mode
    const qdrantHost = config.qdrant.host || 'localhost';
    const qdrantPort = config.qdrant.port || 6333;
    const qdrantApiKey = config.qdrant.apiKey;

    // Try to connect to actual Qdrant instance
    if (process.env.QDRANT_MOCK !== 'true') {
      try {
        const clientOptions = {
          url: `http://${qdrantHost}:${qdrantPort}`
        };

        // Add API key if provided
        if (qdrantApiKey) {
          clientOptions.apiKey = qdrantApiKey;
        }

        qdrantClient = new QdrantClient(clientOptions);

        // Test the connection by listing collections
        await qdrantClient.getCollections();

        logger.info('Qdrant connection initialized', {
          host: qdrantHost,
          port: qdrantPort
        });

        return qdrantClient;
      } catch (connectionError) {
        logger.warn('Could not connect to Qdrant, falling back to mock mode', {
          error: connectionError.message,
          host: qdrantHost,
          port: qdrantPort
        });
      }
    }

    // Fall back to mock mode
    logger.info('Qdrant connection initialized (mock mode)');
    qdrantClient = {
      connected: true,
      mock: true,
      getCollections: async () => ({ collections: [] }),
      search: async () => []
    };
    return qdrantClient;
  } catch (error) {
    logger.error('Qdrant initialization failed', { error: error.message });
    // Return mock client on error
    qdrantClient = {
      connected: true,
      mock: true,
      getCollections: async () => ({ collections: [] }),
      search: async () => []
    };
    return qdrantClient;
  }
}

/**
 * Initialize all database connections
 */
async function initialize() {
  await initPostgres();
  await initQdrant();
  logger.info('All database connections established');
}

/**
 * Get PostgreSQL pool
 */
function getPostgres() {
  if (!pgPool) {
    throw new Error('PostgreSQL not initialized. Call initialize() first.');
  }
  return pgPool;
}

/**
 * Get Qdrant client
 */
function getQdrant() {
  if (!qdrantClient) {
    throw new Error('Qdrant not initialized. Call initialize() first.');
  }
  return qdrantClient;
}

/**
 * Execute a PostgreSQL query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const pool = getPostgres();
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Database query executed', {
      query: text.substring(0, 100),
      duration,
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    logger.error('Database query failed', {
      query: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
}

/**
 * Execute a transaction
 * @param {Function} callback - Function receiving client
 * @returns {Promise<*>} Transaction result
 */
async function transaction(callback) {
  const pool = getPostgres();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close all connections gracefully
 */
async function shutdown() {
  try {
    if (pgPool && pgPool.end) {
      await pgPool.end();
    }
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections', { error: error.message });
  }
}

/**
 * Check database health
 */
async function healthCheck() {
  try {
    const pool = getPostgres();
    if (pool.mock) {
      return { status: 'ok', mode: 'mock' };
    }

    await pool.query('SELECT 1 as healthy');
    return {
      status: 'ok',
      mode: 'connected',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

module.exports = {
  initialize,
  getPostgres,
  getQdrant,
  query,
  transaction,
  shutdown,
  healthCheck
};
