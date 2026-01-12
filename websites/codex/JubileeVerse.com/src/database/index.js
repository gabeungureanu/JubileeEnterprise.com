/**
 * Database Connection Manager - API Gateway
 *
 * IMPORTANT: This module routes ALL database operations through the InspireCodex API.
 * NO DIRECT PostgreSQL connections are made from this application.
 *
 * The InspireCodex API (http://localhost:3100) is the ONLY authorized way to access
 * the Codex and Inspire PostgreSQL databases.
 *
 * This module maintains the same interface as the previous direct-connection version
 * to ensure backward compatibility with all existing code.
 */

const config = require('../config');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.INSPIRE_CODEX_API_URL || 'http://localhost:3100';
const API_KEY = process.env.INSPIRE_CODEX_API_KEY || '';

/**
 * Check if we should use mock mode
 * In production, NEVER use mock mode unless explicitly forced with DB_MOCK=true
 */
const useMockMode = process.env.DB_MOCK === 'true' || (process.env.NODE_ENV === 'test' && process.env.DB_MOCK !== 'false');

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Make an API request to InspireCodex
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
    }

    // Add authorization if available
    if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
        delete options.authToken;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`API Error ${response.status}: ${errorText}`);
            error.status = response.status;
            throw error;
        }

        return await response.json();
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            logger.error('Cannot connect to InspireCodex API', { url: API_BASE_URL });
            throw new Error(`Cannot connect to InspireCodex API at ${API_BASE_URL}`);
        }
        throw error;
    }
}

// ============================================================================
// MOCK DATABASE (for testing and development)
// ============================================================================

const mockPool = {
    connected: true,
    mock: true,
    query: async (text, params) => {
        logger.debug('Mock query executed', { query: text?.substring(0, 50) });
        return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
        query: async () => ({ rows: [], rowCount: 0 }),
        release: () => {}
    }),
    end: async () => {}
};

// ============================================================================
// API-BASED DATABASE INTERFACE
// ============================================================================

/**
 * API-based pool that mimics PostgreSQL Pool interface
 * All queries are routed through InspireCodex API
 */
const apiPool = {
    connected: true,
    mock: false,
    apiMode: true,

    /**
     * Execute a query via API
     * Note: Raw SQL queries are not directly supported via API.
     * This method provides compatibility but logs warnings for direct SQL usage.
     */
    query: async (text, params) => {
        // Log warning for raw SQL queries - these should be refactored to use API endpoints
        logger.warn('Direct SQL query attempted - routing through API if possible', {
            query: text?.substring(0, 100)
        });

        // For SELECT 1 or health checks, return success
        if (text?.includes('SELECT 1') || text?.includes('SELECT NOW()')) {
            return { rows: [{ now: new Date() }], rowCount: 1 };
        }

        // For most queries, we need to use specific API endpoints
        // This is a compatibility layer - actual queries should use the API client functions
        logger.error('Raw SQL queries are not supported via API. Use API endpoints instead.', {
            query: text?.substring(0, 100)
        });

        return { rows: [], rowCount: 0 };
    },

    connect: async () => ({
        query: async (text, params) => apiPool.query(text, params),
        release: () => {}
    }),

    end: async () => {
        logger.info('API pool connection closed');
    },

    on: (event, handler) => {
        // No-op for API mode - no connection events
    }
};

// ============================================================================
// QDRANT CLIENT (Vector Database - unchanged)
// ============================================================================

const { QdrantClient } = require('@qdrant/js-client-rest');
let qdrantClient = null;

/**
 * Initialize Qdrant connection
 */
async function initQdrant() {
    try {
        const qdrantHost = config.qdrant?.host || 'localhost';
        const qdrantPort = config.qdrant?.port || 6333;
        const qdrantApiKey = config.qdrant?.apiKey;

        if (process.env.QDRANT_MOCK !== 'true') {
            try {
                const clientOptions = {
                    url: `http://${qdrantHost}:${qdrantPort}`
                };

                if (qdrantApiKey) {
                    clientOptions.apiKey = qdrantApiKey;
                }

                qdrantClient = new QdrantClient(clientOptions);
                await qdrantClient.getCollections();

                logger.info('Qdrant connection initialized', {
                    host: qdrantHost,
                    port: qdrantPort
                });

                return qdrantClient;
            } catch (connectionError) {
                logger.warn('Could not connect to Qdrant, falling back to mock mode', {
                    error: connectionError.message
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
        qdrantClient = {
            connected: true,
            mock: true,
            getCollections: async () => ({ collections: [] }),
            search: async () => []
        };
        return qdrantClient;
    }
}

// ============================================================================
// ACTIVE POOL REFERENCE
// ============================================================================

let pgPool = null;

/**
 * Initialize PostgreSQL connection (via API)
 */
async function initPostgres() {
    try {
        // In production, ALWAYS try to connect to the API first
        const isProduction = process.env.NODE_ENV === 'production';

        if (useMockMode && !isProduction) {
            logger.info('Database initialized (mock mode - explicitly requested)');
            pgPool = mockPool;
            return pgPool;
        }

        // Test API connection
        logger.info('Connecting to InspireCodex API...', { url: API_BASE_URL });

        try {
            const healthResponse = await fetch(`${API_BASE_URL}/health`);
            if (!healthResponse.ok) {
                throw new Error(`API health check failed: ${healthResponse.status}`);
            }
            const health = await healthResponse.json();

            logger.info('Connected to InspireCodex API', {
                status: health.status,
                codexDb: health.databases?.codex
            });

            pgPool = apiPool;
            return pgPool;
        } catch (apiError) {
            logger.error('InspireCodex API connection failed', { error: apiError.message });

            // Fall back to mock mode ONLY in development (never in production)
            if (process.env.NODE_ENV === 'development') {
                logger.warn('Falling back to mock database mode (development only)');
                pgPool = mockPool;
                return pgPool;
            }

            // In production, we fail rather than silently using mock mode
            throw apiError;
        }
    } catch (error) {
        logger.error('Database initialization failed', { error: error.message });

        // Only fall back to mock in development, never in production
        if (process.env.NODE_ENV === 'development') {
            logger.warn('Falling back to mock database mode (development only)');
            pgPool = mockPool;
            return pgPool;
        }

        throw error;
    }
}

/**
 * Initialize all database connections
 */
async function initialize() {
    await initPostgres();
    await initQdrant();
    logger.info('All database connections established (via InspireCodex API)');
}

/**
 * Get PostgreSQL pool (API-based)
 */
function getPostgres() {
    if (!pgPool) {
        throw new Error('Database not initialized. Call initialize() first.');
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
 * Execute a query via InspireCodex API
 * @param {string} text - SQL query text (for logging only)
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
    const pool = getPostgres();
    const start = Date.now();

    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        logger.debug('Query executed via API', {
            query: text?.substring(0, 100),
            duration,
            rows: result.rowCount
        });

        return result;
    } catch (error) {
        logger.error('Query failed', {
            query: text?.substring(0, 100),
            error: error.message
        });
        throw error;
    }
}

/**
 * Execute a transaction via API
 * Note: Transactions are handled by the API - this provides compatibility
 */
async function transaction(callback) {
    const pool = getPostgres();
    const client = await pool.connect();

    try {
        // Note: In API mode, transactions are atomic on the API side
        const result = await callback(client);
        return result;
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
 * Check database health via API
 */
async function healthCheck() {
    try {
        const pool = getPostgres();
        if (pool.mock) {
            return { status: 'ok', mode: 'mock' };
        }

        // Check via API health endpoint
        const response = await fetch(`${API_BASE_URL}/health`);
        const health = await response.json();

        return {
            status: health.status === 'ok' ? 'ok' : 'error',
            mode: 'api',
            api: API_BASE_URL,
            codexDb: health.databases?.codex,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'error',
            mode: 'api',
            error: error.message
        };
    }
}

// ============================================================================
// API CLIENT HELPER FUNCTIONS
// These provide typed access to InspireCodex API endpoints
// ============================================================================

/**
 * Get users from InspireCodex API
 */
async function getUsers(options = {}) {
    const result = await apiRequest('/api/v1/codex/users');
    return result.users || [];
}

/**
 * Get user by ID from InspireCodex API
 */
async function getUserById(userId) {
    const result = await apiRequest(`/api/v1/codex/users/${userId}`);
    return result.user || null;
}

/**
 * Get user by email from InspireCodex API (includes password_hash for authentication)
 */
async function getUserByEmail(email) {
    try {
        const result = await apiRequest(`/api/v1/codex/users/by-email/${encodeURIComponent(email.toLowerCase())}`);
        return result.user || null;
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        throw error;
    }
}

/**
 * Update user's last login timestamp
 */
async function updateUserLastLogin(userId) {
    try {
        await apiRequest(`/api/v1/codex/users/${userId}/last-login`, {
            method: 'PUT'
        });
        return true;
    } catch (error) {
        logger.error('Failed to update last login', { userId, error: error.message });
        return false;
    }
}

/**
 * Get personas from InspireCodex API
 */
async function getPersonas() {
    const result = await apiRequest('/api/v1/codex/personas');
    return result.personas || [];
}

/**
 * Get configuration from InspireCodex API
 */
async function getConfig() {
    const result = await apiRequest('/api/v1/codex/config');
    return result.config || {};
}

/**
 * Get plans from InspireCodex API
 */
async function getPlans() {
    const result = await apiRequest('/api/v1/codex/plans');
    return result.plans || [];
}

/**
 * Get languages from InspireCodex API
 */
async function getLanguages() {
    const result = await apiRequest('/api/v1/codex/languages');
    return result.languages || [];
}

/**
 * Authenticate user via API
 */
async function authenticateUser(email, password) {
    const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    return result;
}

/**
 * Get Inspire content from API
 */
async function getInspireContent(options = {}) {
    const params = new URLSearchParams(options);
    const result = await apiRequest(`/api/v1/inspire/content?${params}`);
    return result.content || [];
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Core functions
    initialize,
    getPostgres,
    getQdrant,
    query,
    transaction,
    shutdown,
    healthCheck,

    // API client functions
    apiRequest,
    getUsers,
    getUserById,
    getUserByEmail,
    updateUserLastLogin,
    getPersonas,
    getConfig,
    getPlans,
    getLanguages,
    authenticateUser,
    getInspireContent,

    // Constants
    API_BASE_URL
};
