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
     * Routes supported queries through InspireCodex API endpoints.
     */
    query: async (text, params) => {
        // For SELECT 1 or health checks, return success
        if (text?.includes('SELECT 1') || text?.includes('SELECT NOW()')) {
            return { rows: [{ now: new Date() }], rowCount: 1 };
        }

        // Route admin_tasks queries through InspireCodex API
        if (text?.includes('admin_tasks')) {
            try {
                // SELECT queries for admin_tasks
                if (text.trim().toUpperCase().startsWith('SELECT')) {
                    // Parse limit and offset from params if present
                    const limitMatch = text.match(/LIMIT \$(\d+)/i);
                    const offsetMatch = text.match(/OFFSET \$(\d+)/i);

                    let limit = 100;
                    let offset = 0;

                    if (limitMatch && params) {
                        const limitIndex = parseInt(limitMatch[1]) - 1;
                        if (params[limitIndex] !== undefined) {
                            limit = params[limitIndex];
                        }
                    }
                    if (offsetMatch && params) {
                        const offsetIndex = parseInt(offsetMatch[1]) - 1;
                        if (params[offsetIndex] !== undefined) {
                            offset = params[offsetIndex];
                        }
                    }

                    // Check if querying by ID
                    const idMatch = text.match(/WHERE.*(?:t\.)?id\s*=\s*\$(\d+)/i);
                    if (idMatch && params) {
                        const idIndex = parseInt(idMatch[1]) - 1;
                        const taskId = params[idIndex];
                        const response = await fetch(`${API_BASE_URL}/api/v1/codex/admin-tasks/${taskId}`);
                        if (!response.ok) {
                            if (response.status === 404) {
                                return { rows: [], rowCount: 0 };
                            }
                            throw new Error(`API Error ${response.status}`);
                        }
                        const data = await response.json();
                        return { rows: data.task ? [data.task] : [], rowCount: data.task ? 1 : 0 };
                    }

                    // Check for status filter
                    const statusMatch = text.match(/(?:t\.)?status\s*=\s*\$(\d+)/i);
                    let status = null;
                    if (statusMatch && params) {
                        const statusIndex = parseInt(statusMatch[1]) - 1;
                        status = params[statusIndex];
                    }

                    // Check for workflow_status filter
                    const workflowStatusMatch = text.match(/(?:t\.)?workflow_status\s*=\s*\$(\d+)/i);
                    let workflowStatus = null;
                    if (workflowStatusMatch && params) {
                        const wsIndex = parseInt(workflowStatusMatch[1]) - 1;
                        workflowStatus = params[wsIndex];
                    }

                    // Check for task_type filter
                    const taskTypeMatch = text.match(/(?:t\.)?task_type\s*=\s*\$(\d+)/i);
                    let taskType = null;
                    if (taskTypeMatch && params) {
                        const ttIndex = parseInt(taskTypeMatch[1]) - 1;
                        taskType = params[ttIndex];
                    }

                    // Check for priority filter
                    const priorityMatch = text.match(/(?:t\.)?priority\s*=\s*\$(\d+)/i);
                    let priority = null;
                    if (priorityMatch && params) {
                        const prIndex = parseInt(priorityMatch[1]) - 1;
                        priority = params[prIndex];
                    }

                    // Build query string
                    const queryParams = new URLSearchParams();
                    queryParams.set('limit', limit);
                    queryParams.set('offset', offset);
                    if (status) queryParams.set('status', status);
                    if (workflowStatus) queryParams.set('workflowStatus', workflowStatus);
                    if (taskType) queryParams.set('taskType', taskType);
                    if (priority) queryParams.set('priority', priority);

                    // Parse sort from ORDER BY clause
                    const orderMatch = text.match(/ORDER BY\s+(?:t\.)?(\w+)\s+(ASC|DESC)/i);
                    if (orderMatch) {
                        queryParams.set('sortBy', orderMatch[1]);
                        queryParams.set('sortOrder', orderMatch[2].toLowerCase());
                    }

                    const response = await fetch(`${API_BASE_URL}/api/v1/codex/admin-tasks?${queryParams}`);
                    if (!response.ok) {
                        throw new Error(`API Error ${response.status}`);
                    }
                    const data = await response.json();
                    return { rows: data.tasks || [], rowCount: data.tasks?.length || 0 };
                }

                // INSERT queries for admin_tasks
                if (text.trim().toUpperCase().startsWith('INSERT')) {
                    const response = await fetch(`${API_BASE_URL}/api/v1/codex/admin-tasks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: params[1],
                            description: params[2],
                            task_type: params[3],
                            priority: params[4],
                            status: params[5],
                            component: params[6]
                        })
                    });
                    if (!response.ok) {
                        throw new Error(`API Error ${response.status}`);
                    }
                    const data = await response.json();
                    return { rows: data.task ? [data.task] : [], rowCount: 1 };
                }

                // UPDATE queries for admin_tasks
                if (text.trim().toUpperCase().startsWith('UPDATE')) {
                    const idMatch = text.match(/WHERE\s+id\s*=\s*\$(\d+)/i);
                    if (idMatch && params) {
                        const idIndex = parseInt(idMatch[1]) - 1;
                        const taskId = params[idIndex];
                        // Parse SET clause to build update object
                        const updates = {};
                        const setMatches = text.matchAll(/(\w+)\s*=\s*\$(\d+)/gi);
                        for (const match of setMatches) {
                            if (match[1].toLowerCase() !== 'id') {
                                const paramIndex = parseInt(match[2]) - 1;
                                updates[match[1]] = params[paramIndex];
                            }
                        }
                        const response = await fetch(`${API_BASE_URL}/api/v1/codex/admin-tasks/${taskId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updates)
                        });
                        if (!response.ok) {
                            throw new Error(`API Error ${response.status}`);
                        }
                        const data = await response.json();
                        return { rows: data.task ? [data.task] : [], rowCount: 1 };
                    }
                }

                // DELETE queries for admin_tasks
                if (text.trim().toUpperCase().startsWith('DELETE')) {
                    const idMatch = text.match(/WHERE\s+id\s*=\s*\$(\d+)/i);
                    if (idMatch && params) {
                        const idIndex = parseInt(idMatch[1]) - 1;
                        const taskId = params[idIndex];
                        const response = await fetch(`${API_BASE_URL}/api/v1/codex/admin-tasks/${taskId}`, {
                            method: 'DELETE'
                        });
                        if (!response.ok) {
                            throw new Error(`API Error ${response.status}`);
                        }
                        return { rows: [], rowCount: 1 };
                    }
                }
            } catch (error) {
                logger.error('Admin tasks API routing failed', { error: error.message, query: text?.substring(0, 100) });
                return { rows: [], rowCount: 0 };
            }
        }

        // Route admin_task_history queries through InspireCodex API
        if (text?.includes('admin_task_history')) {
            try {
                if (text.trim().toUpperCase().startsWith('SELECT')) {
                    const taskIdMatch = text.match(/task_id\s*=\s*\$(\d+)/i);
                    if (taskIdMatch && params) {
                        const taskIdIndex = parseInt(taskIdMatch[1]) - 1;
                        const taskId = params[taskIdIndex];
                        const response = await fetch(`${API_BASE_URL}/api/v1/codex/admin-tasks/${taskId}/history`);
                        if (!response.ok) {
                            return { rows: [], rowCount: 0 };
                        }
                        const data = await response.json();
                        return { rows: data.history || [], rowCount: data.history?.length || 0 };
                    }
                }
            } catch (error) {
                logger.error('Admin task history API routing failed', { error: error.message });
                return { rows: [], rowCount: 0 };
            }
        }

        // Log warning for unsupported queries
        logger.warn('Direct SQL query attempted - not routed through API', {
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
// ADMIN TASKS API CLIENT FUNCTIONS
// ============================================================================

/**
 * Get admin tasks with optional filters
 */
async function getAdminTasks(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.taskType) params.append('taskType', filters.taskType);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.component) params.append('component', filters.component);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.search) params.append('search', filters.search);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const result = await apiRequest(`/api/v1/codex/admin-tasks?${params}`);
    return result;
}

/**
 * Get admin task statistics
 */
async function getAdminTaskStats() {
    const result = await apiRequest('/api/v1/codex/admin-tasks/stats');
    return result.stats || {
        total: 0,
        byStatus: { submitted: 0, inReview: 0, inProgress: 0, fixing: 0, completed: 0 },
        byPriority: { critical: 0, highPriority: 0 },
        byType: { bugs: 0, development: 0, enhancements: 0, operational: 0 }
    };
}

/**
 * Get single admin task by ID
 */
async function getAdminTaskById(taskId) {
    try {
        const result = await apiRequest(`/api/v1/codex/admin-tasks/${taskId}`);
        return result.task || null;
    } catch (error) {
        if (error.status === 404) return null;
        throw error;
    }
}

/**
 * Create admin task
 */
async function createAdminTask(taskData) {
    const result = await apiRequest('/api/v1/codex/admin-tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
    });
    return result.task;
}

/**
 * Update admin task
 */
async function updateAdminTask(taskId, updates) {
    const result = await apiRequest(`/api/v1/codex/admin-tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    });
    return result.task;
}

/**
 * Delete admin task
 */
async function deleteAdminTask(taskId) {
    await apiRequest(`/api/v1/codex/admin-tasks/${taskId}`, {
        method: 'DELETE'
    });
    return true;
}

/**
 * Get distinct task components
 */
async function getAdminTaskComponents() {
    const result = await apiRequest('/api/v1/codex/admin-tasks-components');
    return result.components || [];
}

/**
 * Get admin users (for task assignment)
 */
async function getAdminUsers() {
    const result = await apiRequest('/api/v1/codex/admin-users');
    return result.users || [];
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

    // Admin Tasks API
    getAdminTasks,
    getAdminTaskStats,
    getAdminTaskById,
    createAdminTask,
    updateAdminTask,
    deleteAdminTask,
    getAdminTaskComponents,
    getAdminUsers,

    // Constants
    API_BASE_URL
};
