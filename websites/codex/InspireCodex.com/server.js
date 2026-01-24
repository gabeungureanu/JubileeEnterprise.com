/**
 * InspireCodex API Server
 *
 * Backend API service for Codex (identity/configuration) and Inspire (ministry content) databases.
 * All client websites must consume Codex and Inspire data only through this API.
 *
 * Port: 3100
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const http = require('http');

// Qdrant RAG Service for semantic search
const qdrantService = require('./services/qdrant-service');

const app = express();
const PORT = process.env.PORT || 3100;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for proper client IP detection behind Cloudflare/reverse proxy
app.set('trust proxy', 1);

// =============================================================================
// DATABASE CONNECTIONS
// =============================================================================

// Environment-based database configuration
const getDbConfig = (dbType) => {
    const isProd = NODE_ENV === 'production';
    const prefix = isProd ? 'PROD_' : '';

    return {
        host: process.env[`${prefix}${dbType}_DB_HOST`] || 'localhost',
        port: parseInt(process.env[`${prefix}${dbType}_DB_PORT`] || '5432'),
        database: process.env[`${prefix}${dbType}_DB_NAME`] || dbType,
        user: process.env[`${prefix}${dbType}_DB_USER`] || 'guardian',
        password: process.env[`${prefix}${dbType}_DB_PASSWORD`],
        max: 20, // Connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
};

// Database pools
const codexPool = new Pool(getDbConfig('CODEX'));
const inspirePool = new Pool(getDbConfig('INSPIRE'));

// Legacy pool (read-only, for migration verification)
const legacyEnabled = process.env.LEGACY_DB_ENABLED === 'true';
let legacyPool = null;
if (legacyEnabled) {
    legacyPool = new Pool({
        host: process.env.LEGACY_DB_HOST || 'localhost',
        port: parseInt(process.env.LEGACY_DB_PORT || '5432'),
        database: process.env.LEGACY_DB_NAME || 'JubileeVerse',
        user: process.env.LEGACY_DB_USER || 'guardian',
        password: process.env.LEGACY_DB_PASSWORD,
        max: 5,
        idleTimeoutMillis: 30000,
    });
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for API
}));

// CORS configuration - allow all Jubilee domains
const allowedCorsOrigins = [
    'https://wwbibleweb.com',
    'https://www.wwbibleweb.com',
    'http://wwbibleweb.com',
    'http://www.wwbibleweb.com',
    'https://jubileeverse.com',
    'https://www.jubileeverse.com',
    'https://jubileeinspire.com',
    'https://www.jubileeinspire.com',
    'https://inspirecodex.com',
    'https://www.inspirecodex.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3100',
    'http://localhost:3003'
];

const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
const finalCorsOrigins = corsOrigins.length > 0 ? [...corsOrigins, ...allowedCorsOrigins] : allowedCorsOrigins;

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list
        if (finalCorsOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Allow all origins as fallback for API access
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept', 'Origin'],
    credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV !== 'test') {
    app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Rate limiting - with whitelist for internal domains
const whitelistedOrigins = [
    'wwbibleweb.com',
    'www.wwbibleweb.com',
    'jubileeverse.com',
    'www.jubileeverse.com',
    'jubileeinspire.com',
    'www.jubileeinspire.com',
    'inspirecodex.com',
    'www.inspirecodex.com',
    'localhost'
];

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10000'), // Increased from 100 to 10000
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for whitelisted origins
        const origin = req.get('origin') || req.get('referer') || '';
        const isWhitelisted = whitelistedOrigins.some(domain => origin.includes(domain));

        // Skip rate limiting for developer tasks API (internal tooling)
        const isDeveloperTasksApi = req.path.startsWith('/api/v1/developer');

        // Skip rate limiting for local requests (no origin = likely internal)
        const isLocalRequest = !origin || origin === '';

        return isWhitelisted || isDeveloperTasksApi || isLocalRequest;
    }
});
app.use('/api/', limiter);

// =============================================================================
// HEALTH & STATUS ENDPOINTS
// =============================================================================

app.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        databases: {}
    };

    // Check Codex connection
    try {
        await codexPool.query('SELECT 1');
        health.databases.codex = 'connected';
    } catch (err) {
        health.databases.codex = 'error: ' + err.message;
        health.status = 'degraded';
    }

    // Check Inspire connection
    try {
        await inspirePool.query('SELECT 1');
        health.databases.inspire = 'connected';
    } catch (err) {
        health.databases.inspire = 'error: ' + err.message;
        health.status = 'degraded';
    }

    // Check Legacy if enabled
    if (legacyEnabled && legacyPool) {
        try {
            await legacyPool.query('SELECT 1');
            health.databases.legacy = 'connected (read-only)';
        } catch (err) {
            health.databases.legacy = 'error: ' + err.message;
        }
    }

    // Check Qdrant RAG service
    const ragStatus = qdrantService.getStatus();
    health.rag = {
        status: ragStatus.initialized ? 'connected' : 'unavailable',
        collection: ragStatus.config.collection,
        error: ragStatus.error || null
    };

    res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// Qdrant RAG status endpoint
app.get('/api/v1/rag/status', async (req, res) => {
    const status = qdrantService.getStatus();
    res.json({
        success: true,
        rag: status
    });
});

// =============================================================================
// DEPLOYMENT WEBHOOK - Allows remote deployment via HTTP
// =============================================================================

const DEPLOY_SECRET = process.env.DEPLOY_SECRET || 'jubilee-deploy-2026';

app.post('/api/deploy', async (req, res) => {
    // Verify deploy secret
    const providedSecret = req.headers['x-deploy-secret'] || req.body.secret;
    if (providedSecret !== DEPLOY_SECRET) {
        console.log('Deploy webhook: Unauthorized attempt');
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    console.log('Deploy webhook: Starting deployment...');

    try {
        const { execSync } = require('child_process');
        const repoPath = 'C:\\data\\JubileeEnterprise.com';

        // Git pull
        const gitOutput = execSync('git pull origin main', {
            cwd: repoPath,
            encoding: 'utf8',
            timeout: 60000
        });

        console.log('Deploy webhook: Git pull completed');
        console.log(gitOutput);

        // Touch web.config to trigger iisnode restart
        const webConfigPath = `${repoPath}\\websites\\codex\\InspireCodex.com\\web.config`;
        try {
            const fs = require('fs');
            const now = new Date();
            fs.utimesSync(webConfigPath, now, now);
            console.log('Deploy webhook: Touched web.config to trigger restart');
        } catch (e) {
            console.log('Deploy webhook: web.config touch failed (may not exist):', e.message);
        }

        res.json({
            success: true,
            message: 'Deployment completed',
            gitOutput: gitOutput.trim(),
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Deploy webhook error:', err);
        res.status(500).json({
            success: false,
            error: 'Deployment failed',
            message: err.message
        });
    }
});

app.get('/api/v1/status', async (req, res) => {
    try {
        // Get database stats
        const codexStats = await codexPool.query(`
            SELECT
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as tables,
                (SELECT COUNT(*) FROM users) as users
        `);

        const inspireStats = await inspirePool.query(`
            SELECT
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as tables
        `);

        res.json({
            api: 'InspireCodex',
            version: '1.0.0',
            environment: NODE_ENV,
            timestamp: new Date().toISOString(),
            databases: {
                codex: {
                    tables: parseInt(codexStats.rows[0].tables),
                    users: parseInt(codexStats.rows[0].users || 0)
                },
                inspire: {
                    tables: parseInt(inspireStats.rows[0].tables)
                }
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get status', message: err.message });
    }
});

// =============================================================================
// ADMIN DASHBOARD API - System Health Aggregation
// =============================================================================

// Admin pool for querying system-level information
const adminPool = new Pool({
    host: process.env.CODEX_DB_HOST || 'localhost',
    port: parseInt(process.env.CODEX_DB_PORT || '5432'),
    database: 'postgres', // Connect to postgres for system-level queries
    user: process.env.CODEX_DB_USER || 'guardian',
    password: process.env.CODEX_DB_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
});

// Comprehensive system health endpoint for admin dashboard
app.get('/api/v1/admin/health', async (req, res) => {
    const startTime = Date.now();
    const health = {
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        uptime: process.uptime(),
        databases: {},
        vectorDatabases: {},
        apiServices: {},
        websites: [],
        system: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            osInfo: {
                totalMemory: require('os').totalmem(),
                freeMemory: require('os').freemem(),
                cpus: require('os').cpus().length,
                cpuModel: require('os').cpus()[0]?.model || 'Unknown',
                loadAvg: require('os').loadavg(),
                hostname: require('os').hostname()
            },
            processInfo: {
                pid: process.pid,
                ppid: process.ppid,
                title: process.title,
                cwd: process.cwd()
            }
        }
    };

    // PostgreSQL Databases (lowercase names match actual PostgreSQL database names)
    const databases = ['codex', 'inspire', 'continuum', 'flywheel'];

    for (const dbName of databases) {
        try {
            const tempPool = new Pool({
                host: process.env.CODEX_DB_HOST || 'localhost',
                port: parseInt(process.env.CODEX_DB_PORT || '5432'),
                database: dbName,
                user: process.env.CODEX_DB_USER || 'guardian',
                password: process.env.CODEX_DB_PASSWORD,
                max: 1,
                connectionTimeoutMillis: 3000,
            });

            // Get table count
            const tableResult = await tempPool.query(`
                SELECT COUNT(*) as count FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            `);

            // Get view count
            const viewResult = await tempPool.query(`
                SELECT COUNT(*) as count FROM information_schema.views
                WHERE table_schema = 'public'
            `);

            // Get database size
            const sizeResult = await tempPool.query(`
                SELECT pg_size_pretty(pg_database_size($1)) as size
            `, [dbName]);

            // Get table list with row counts (top 20)
            const tablesResult = await tempPool.query(`
                SELECT
                    relname as table_name,
                    n_live_tup as row_count
                FROM pg_stat_user_tables
                ORDER BY relname
                LIMIT 20
            `);

            health.databases[dbName] = {
                status: 'connected',
                tables: parseInt(tableResult.rows[0].count),
                views: parseInt(viewResult.rows[0].count),
                size: sizeResult.rows[0].size,
                tableList: tablesResult.rows
            };

            await tempPool.end();
        } catch (err) {
            health.databases[dbName] = {
                status: 'error',
                error: err.message
            };
        }
    }

    // Qdrant Vector Database
    try {
        const qdrantHost = process.env.QDRANT_HOST || 'localhost';
        const qdrantPort = process.env.QDRANT_PORT || '6333';

        const qdrantHealth = await new Promise((resolve) => {
            const req = http.get(`http://${qdrantHost}:${qdrantPort}/collections`, { timeout: 3000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ status: 'connected', collections: parsed.result?.collections || [] });
                    } catch (e) {
                        resolve({ status: 'error', error: 'Invalid response' });
                    }
                });
            });
            req.on('error', (err) => resolve({ status: 'offline', error: err.message }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ status: 'timeout', error: 'Connection timed out' });
            });
        });

        health.vectorDatabases.qdrant = qdrantHealth;
    } catch (err) {
        health.vectorDatabases.qdrant = { status: 'error', error: err.message };
    }

    // API Services Health Checks
    const apiServices = [
        { name: 'InspireCodex', url: 'http://localhost:3100/health', port: 3100 },
        { name: 'InspireContinuum', url: 'http://localhost:3101/health', port: 3101 },
        { name: 'JubileeVerse', url: 'http://localhost:3000/health', port: 3000 },
    ];

    for (const service of apiServices) {
        try {
            const serviceHealth = await new Promise((resolve) => {
                const req = http.get(service.url, { timeout: 3000 }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            resolve({
                                status: res.statusCode === 200 ? 'healthy' : 'degraded',
                                statusCode: res.statusCode,
                                response: parsed
                            });
                        } catch (e) {
                            resolve({ status: 'healthy', statusCode: res.statusCode });
                        }
                    });
                });
                req.on('error', (err) => resolve({ status: 'offline', error: err.message }));
                req.on('timeout', () => {
                    req.destroy();
                    resolve({ status: 'timeout', error: 'Connection timed out' });
                });
            });

            health.apiServices[service.name] = {
                port: service.port,
                ...serviceHealth
            };
        } catch (err) {
            health.apiServices[service.name] = {
                port: service.port,
                status: 'error',
                error: err.message
            };
        }
    }

    // Website Availability Checks - Aggressive validation
    // All Jubilee Enterprise platform websites organized by category
    const websites = [
        // Codex Category - Core Infrastructure & APIs
        { name: 'JubileeVerse.com', url: 'http://localhost:3000', port: 3000, category: 'codex', type: 'app', description: 'AI Chat Platform' },
        { name: 'InspireCodex.com', url: 'http://localhost:3100', port: 3100, category: 'codex', type: 'api', description: 'Central API & Health Dashboard' },
        { name: 'InspireContinuum.com', url: 'http://localhost:3101', port: 3101, category: 'codex', type: 'api', description: 'User Activity & Admin Dashboard' },
        { name: 'JubileeBrowser.com', url: 'http://localhost:3200', port: 3200, category: 'codex', type: 'static', description: 'Browser Download Portal' },
        { name: 'JubileeWebsites.com', url: 'http://localhost:3008', port: 3008, category: 'codex', type: 'app', description: 'AI Website Generator' },
        { name: 'JubileeParadox.com', url: 'http://localhost:3009', port: 3009, category: 'codex', type: 'static', description: 'Book/Movie Platform' },
        { name: 'wwBibleweb.com', url: 'http://localhost:3003', port: 3003, category: 'codex', type: 'static', description: 'IDNS Registry & Bible Web' },

        // Inspire Category - Ministry & Content Sites
        { name: 'JubileeInspire.com', url: 'http://localhost:3001', port: 3001, category: 'inspire', type: 'static', description: 'Ministry Landing Page' },
        { name: 'CelestialPaths.com', url: 'http://localhost:3300', port: 3300, category: 'inspire', type: 'static', description: 'Spiritual Journey Platform' },
    ];

    // Aggressive website health check function
    const checkWebsite = (site) => {
        return new Promise((resolve) => {
            const startMs = Date.now();
            let resolved = false;

            // Set a hard timeout - if no response in 2 seconds, it's down
            const hardTimeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve({
                        name: site.name,
                        url: site.url,
                        port: site.port,
                        category: site.category,
                        type: site.type,
                        description: site.description,
                        status: 'offline',
                        error: 'No response within 2 seconds',
                        responseTime: 2000
                    });
                }
            }, 2000);

            const req = http.get(site.url, {
                timeout: 1500,
                headers: { 'Connection': 'close' }
            }, (res) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(hardTimeout);

                // Read the response body to ensure connection is complete
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    const responseTime = Date.now() - startMs;
                    // Check for valid HTTP response and reasonable content
                    const isValidResponse = res.statusCode >= 200 && res.statusCode < 500;
                    const hasContent = data.length > 0 || res.statusCode === 204;

                    resolve({
                        name: site.name,
                        url: site.url,
                        port: site.port,
                        category: site.category,
                        type: site.type,
                        description: site.description,
                        status: isValidResponse && hasContent ? 'online' : 'error',
                        statusCode: res.statusCode,
                        responseTime: responseTime,
                        contentLength: data.length
                    });
                });
            });

            req.on('error', (err) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(hardTimeout);

                // Determine specific error type
                let errorType = 'offline';
                let errorMsg = err.message;

                if (err.code === 'ECONNREFUSED') {
                    errorMsg = `Port ${site.port} connection refused`;
                } else if (err.code === 'ECONNRESET') {
                    errorMsg = 'Connection reset by server';
                } else if (err.code === 'ETIMEDOUT') {
                    errorType = 'timeout';
                    errorMsg = 'Connection timed out';
                } else if (err.code === 'ENOTFOUND') {
                    errorMsg = 'Host not found';
                }

                resolve({
                    name: site.name,
                    url: site.url,
                    port: site.port,
                    category: site.category,
                    type: site.type,
                    description: site.description,
                    status: errorType,
                    error: errorMsg,
                    errorCode: err.code
                });
            });

            req.on('timeout', () => {
                if (resolved) return;
                req.destroy();
                // Let the hardTimeout handle this
            });
        });
    };

    // Check all websites in parallel for speed
    const websiteResults = await Promise.all(websites.map(site => checkWebsite(site)));
    health.websites = websiteResults;

    // Codex Services (IDNS, etc.)
    health.codexServices = {};

    // IDNS Domains
    try {
        const tempPool = new Pool({
            host: process.env.CODEX_DB_HOST || 'localhost',
            port: parseInt(process.env.CODEX_DB_PORT || '5432'),
            database: 'codex',
            user: process.env.CODEX_DB_USER || 'guardian',
            password: process.env.CODEX_DB_PASSWORD,
            max: 1,
            connectionTimeoutMillis: 3000,
        });

        // Check if idns_domains table exists and get counts
        const tableCheck = await tempPool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'idns_domains'
            )
        `);

        if (tableCheck.rows[0].exists) {
            const countResult = await tempPool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE is_active = true) as active_count,
                    COUNT(*) as total_count
                FROM idns_domains
            `);

            const typeBreakdown = await tempPool.query(`
                SELECT domain_type, COUNT(*) as count
                FROM idns_domains
                WHERE is_active = true
                GROUP BY domain_type
                ORDER BY count DESC
            `);

            health.codexServices.idns = {
                status: 'active',
                activeEntries: parseInt(countResult.rows[0].active_count),
                totalEntries: parseInt(countResult.rows[0].total_count),
                byType: typeBreakdown.rows.reduce((acc, row) => {
                    acc[row.domain_type] = parseInt(row.count);
                    return acc;
                }, {})
            };
        } else {
            health.codexServices.idns = {
                status: 'not_configured',
                error: 'IDNS table not found'
            };
        }

        // JubileeSSO - User accounts
        const userCount = await tempPool.query('SELECT COUNT(*) as count FROM users');
        const activeSessionCount = await tempPool.query('SELECT COUNT(*) as count FROM session');

        health.codexServices.sso = {
            status: 'active',
            accounts: parseInt(userCount.rows[0].count),
            activeSessions: parseInt(activeSessionCount.rows[0].count)
        };

        await tempPool.end();
    } catch (err) {
        health.codexServices.idns = {
            status: 'error',
            error: err.message
        };
        health.codexServices.sso = {
            status: 'error',
            error: err.message
        };
    }

    health.queryTime = Date.now() - startTime;
    res.json(health);
});

// Static file serving for admin dashboard
app.use(express.static('public'));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================================================
// CODEX API ROUTES - Identity & Configuration
// =============================================================================

// Users
app.get('/api/v1/codex/users', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const result = await codexPool.query(`
            SELECT id, email, display_name, avatar_url, role, created_at, last_login_at, is_active
            FROM users
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await codexPool.query('SELECT COUNT(*) FROM users');

        res.json({
            users: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users', message: err.message });
    }
});

app.get('/api/v1/codex/users/:id', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT id, email, display_name, avatar_url, role,
                   created_at, last_login_at, is_active, updated_at
            FROM users WHERE id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('Get user by ID error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch user', message: err.message });
    }
});

// User lookup by email (for internal authentication)
// Returns full user data including password_hash for verification
app.get('/api/v1/codex/users/by-email/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();
        const result = await codexPool.query(`
            SELECT id, email, password_hash, display_name, avatar_url, role,
                   is_active, last_login_at, created_at, updated_at
            FROM users WHERE email = $1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('User lookup error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch user', message: err.message });
    }
});

// Update user last login timestamp
app.put('/api/v1/codex/users/:id/last-login', async (req, res) => {
    try {
        await codexPool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1',
            [req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Update last login error:', err);
        res.status(500).json({ success: false, error: 'Failed to update last login' });
    }
});

// Update user password hash (internal endpoint for password reset)
app.put('/api/v1/codex/users/:id/password', async (req, res) => {
    try {
        const { password_hash } = req.body;

        if (!password_hash) {
            return res.status(400).json({
                success: false,
                error: 'password_hash is required'
            });
        }

        const result = await codexPool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email',
            [password_hash, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        console.log(`User password updated: ${result.rows[0].email}`);
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('Update password error:', err);
        res.status(500).json({ success: false, error: 'Failed to update password' });
    }
});

// Update user role (admin endpoint)
app.put('/api/v1/codex/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['user', 'contributor', 'reviewer', 'moderator', 'admin'];

        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
        }

        const result = await codexPool.query(
            'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role',
            [role, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        console.log(`User role updated: ${result.rows[0].email} -> ${role}`);
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('Update role error:', err);
        res.status(500).json({ success: false, error: 'Failed to update role' });
    }
});

// =============================================================================
// EMAIL API ROUTES - Mail Server Accounts (hMailServer/Mailcow)
// =============================================================================

// Get all email accounts configured on the mail server
app.get('/api/v1/email/accounts', async (req, res) => {
    try {
        // Email accounts configured in hMailServer (WSL production server)
        // These are the actual mailboxes from the infrastructure configuration
        const emailAccounts = [
            // worldwidebibleweb.com domain (5 accounts)
            {
                email: 'noreply@worldwidebibleweb.com',
                domain: 'worldwidebibleweb.com',
                description: 'No Reply - System notifications',
                quotaMB: 100,
                active: true
            },
            {
                email: 'support@worldwidebibleweb.com',
                domain: 'worldwidebibleweb.com',
                description: 'Support Team',
                quotaMB: 500,
                active: true
            },
            {
                email: 'admin@worldwidebibleweb.com',
                domain: 'worldwidebibleweb.com',
                description: 'Administrator',
                quotaMB: 1024,
                active: true
            },
            {
                email: 'ai01@worldwidebibleweb.com',
                domain: 'worldwidebibleweb.com',
                description: 'AI Agent 01',
                quotaMB: 100,
                active: true
            },
            {
                email: 'ai02@worldwidebibleweb.com',
                domain: 'worldwidebibleweb.com',
                description: 'AI Agent 02',
                quotaMB: 100,
                active: true
            },
            // jubileebrowser.com domain (3 accounts)
            {
                email: 'noreply@jubileebrowser.com',
                domain: 'jubileebrowser.com',
                description: 'No Reply - System notifications',
                quotaMB: 100,
                active: true
            },
            {
                email: 'support@jubileebrowser.com',
                domain: 'jubileebrowser.com',
                description: 'Support Team',
                quotaMB: 500,
                active: true
            },
            {
                email: 'feedback@jubileebrowser.com',
                domain: 'jubileebrowser.com',
                description: 'Feedback',
                quotaMB: 500,
                active: true
            },
            // jubileeverse.com domain (2 accounts)
            {
                email: 'noreply@jubileeverse.com',
                domain: 'jubileeverse.com',
                description: 'No Reply - System notifications',
                quotaMB: 100,
                active: true
            },
            {
                email: 'hello@jubileeverse.com',
                domain: 'jubileeverse.com',
                description: 'Hello - General inquiries',
                quotaMB: 500,
                active: true
            }
        ];

        // Get unique domains
        const domains = [...new Set(emailAccounts.map(a => a.domain))];

        res.json({
            success: true,
            accounts: emailAccounts,
            total: emailAccounts.length,
            domains: domains,
            domainCount: domains.length,
            mailServer: 'hMailServer',
            relayHost: 'Amazon SES (email-smtp.us-east-1.amazonaws.com)'
        });
    } catch (err) {
        console.error('Get email accounts error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch email accounts',
            message: err.message
        });
    }
});

// Personas
app.get('/api/v1/codex/personas', async (req, res) => {
    try {
        const { active_only = 'true', limit = 100 } = req.query;
        let query = `
            SELECT id, name, slug, short_bio, full_bio, greeting_message, is_active, category_id,
                   avatar_url, is_featured, usage_count, average_rating, created_at, updated_at
            FROM personas
        `;

        if (active_only === 'true') {
            query += ' WHERE is_active = true';
        }

        query += ' ORDER BY name LIMIT $1';

        const result = await codexPool.query(query, [limit]);
        res.json({ personas: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch personas', message: err.message });
    }
});

app.get('/api/v1/codex/personas/:id', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT * FROM personas WHERE id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Persona not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch persona', message: err.message });
    }
});

// Configuration
app.get('/api/v1/codex/config', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT key, value, description, updated_at
            FROM system_config
            ORDER BY key
        `);

        const config = {};
        result.rows.forEach(row => {
            config[row.key] = {
                value: row.value,
                description: row.description,
                updated_at: row.updated_at
            };
        });

        res.json({ config });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch config', message: err.message });
    }
});

// Subscription Plans
app.get('/api/v1/codex/plans', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT id, name, slug, description, price_monthly, price_yearly,
                   features, is_active, sort_order
            FROM subscription_plans
            WHERE is_active = true
            ORDER BY sort_order
        `);

        res.json({ plans: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch plans', message: err.message });
    }
});

// Languages
app.get('/api/v1/codex/languages', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT code, name, native_name, is_active, direction, display_order
            FROM languages
            WHERE is_active = true
            ORDER BY display_order, name
        `);

        res.json({ languages: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch languages', message: err.message });
    }
});

// Bible Verses
app.get('/api/v1/codex/bible/verses', async (req, res) => {
    try {
        const { book, chapter, verse_start, verse_end, translation = 'KJV', limit = 100 } = req.query;

        let query = `
            SELECT id, book_id, book_name, book_order, chapter_number, verse_number,
                   verse_text, verse_preview, translation_code, translation_name,
                   section_heading, metadata
            FROM bible_verses WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (book) {
            params.push(book);
            query += ` AND book_name ILIKE $${++paramCount}`;
        }
        if (chapter) {
            params.push(parseInt(chapter));
            query += ` AND chapter_number = $${++paramCount}`;
        }
        if (verse_start) {
            params.push(parseInt(verse_start));
            query += ` AND verse_number >= $${++paramCount}`;
        }
        if (verse_end) {
            params.push(parseInt(verse_end));
            query += ` AND verse_number <= $${++paramCount}`;
        }
        if (translation) {
            params.push(translation);
            query += ` AND translation_code = $${++paramCount}`;
        }

        params.push(parseInt(limit));
        query += ` ORDER BY book_order, chapter_number, verse_number LIMIT $${++paramCount}`;

        const result = await codexPool.query(query, params);
        res.json({ verses: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch verses', message: err.message });
    }
});

// =============================================================================
// ADMIN TASKS API ROUTES
// =============================================================================

// Get all admin tasks with optional filters
app.get('/api/v1/codex/admin-tasks', async (req, res) => {
    try {
        const { status, taskType, priority, component, assignedTo, search, sortBy, sortOrder, limit, offset } = req.query;

        let query = `
            SELECT t.*,
                   creator.display_name as created_by_name,
                   assignee.display_name as assigned_to_name
            FROM admin_tasks t
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN users assignee ON t.assigned_to = assignee.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (status) {
            params.push(status);
            query += ` AND t.status = $${++paramCount}`;
        }
        if (taskType) {
            params.push(taskType);
            query += ` AND t.task_type = $${++paramCount}`;
        }
        if (priority) {
            params.push(priority);
            query += ` AND t.priority = $${++paramCount}`;
        }
        if (component) {
            params.push(component);
            query += ` AND t.component = $${++paramCount}`;
        }
        if (assignedTo) {
            params.push(assignedTo);
            query += ` AND t.assigned_to = $${++paramCount}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (t.title ILIKE $${++paramCount} OR t.description ILIKE $${paramCount})`;
        }

        // Sorting
        const validSortColumns = ['task_number', 'created_at', 'updated_at', 'priority', 'status'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'task_number';
        const sortDir = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY t.${sortColumn} ${sortDir}`;

        // Pagination
        const limitNum = Math.min(parseInt(limit) || 100, 500);
        const offsetNum = parseInt(offset) || 0;
        params.push(limitNum);
        query += ` LIMIT $${++paramCount}`;
        params.push(offsetNum);
        query += ` OFFSET $${++paramCount}`;

        const result = await codexPool.query(query, params);
        res.json({ tasks: result.rows, total: result.rowCount });
    } catch (err) {
        console.error('Error fetching admin tasks:', err);
        res.status(500).json({ error: 'Failed to fetch admin tasks', message: err.message });
    }
});

// Get admin task statistics
app.get('/api/v1/codex/admin-tasks/stats', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
                COUNT(*) FILTER (WHERE status = 'in_review') as in_review,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                COUNT(*) FILTER (WHERE status = 'fixing') as fixing,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE priority = 'critical') as critical,
                COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
                COUNT(*) FILTER (WHERE task_type = 'bug') as bugs,
                COUNT(*) FILTER (WHERE task_type = 'development') as development,
                COUNT(*) FILTER (WHERE task_type = 'enhancement') as enhancements,
                COUNT(*) FILTER (WHERE task_type = 'operational') as operational
            FROM admin_tasks
        `);

        const row = result.rows[0] || {};
        res.json({
            stats: {
                total: parseInt(row.total) || 0,
                byStatus: {
                    submitted: parseInt(row.submitted) || 0,
                    inReview: parseInt(row.in_review) || 0,
                    inProgress: parseInt(row.in_progress) || 0,
                    fixing: parseInt(row.fixing) || 0,
                    completed: parseInt(row.completed) || 0
                },
                byPriority: {
                    critical: parseInt(row.critical) || 0,
                    highPriority: parseInt(row.high_priority) || 0
                },
                byType: {
                    bugs: parseInt(row.bugs) || 0,
                    development: parseInt(row.development) || 0,
                    enhancements: parseInt(row.enhancements) || 0,
                    operational: parseInt(row.operational) || 0
                }
            }
        });
    } catch (err) {
        console.error('Error fetching admin task stats:', err);
        res.status(500).json({ error: 'Failed to fetch stats', message: err.message });
    }
});

// Get single admin task by ID
app.get('/api/v1/codex/admin-tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await codexPool.query(`
            SELECT t.*,
                   creator.display_name as created_by_name,
                   assignee.display_name as assigned_to_name
            FROM admin_tasks t
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN users assignee ON t.assigned_to = assignee.id
            WHERE t.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ task: result.rows[0] });
    } catch (err) {
        console.error('Error fetching admin task:', err);
        res.status(500).json({ error: 'Failed to fetch task', message: err.message });
    }
});

// Get task history
app.get('/api/v1/codex/admin-tasks/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await codexPool.query(`
            SELECT h.*, u.display_name as changed_by_name
            FROM admin_task_history h
            LEFT JOIN users u ON h.changed_by = u.id
            WHERE h.task_id = $1
            ORDER BY h.changed_at DESC
        `, [id]);
        res.json({ history: result.rows });
    } catch (err) {
        console.error('Error fetching task history:', err);
        res.status(500).json({ error: 'Failed to fetch history', message: err.message });
    }
});

// Create admin task
app.post('/api/v1/codex/admin-tasks', async (req, res) => {
    try {
        const { title, description, task_type, priority, status, component, assigned_to, created_by } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const result = await codexPool.query(`
            INSERT INTO admin_tasks (title, description, task_type, priority, status, component, assigned_to, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            title,
            description || null,
            task_type || 'development',
            priority || 'medium',
            status || 'submitted',
            component || null,
            assigned_to || null,
            created_by || null
        ]);

        res.status(201).json({ task: result.rows[0] });
    } catch (err) {
        console.error('Error creating admin task:', err);
        res.status(500).json({ error: 'Failed to create task', message: err.message });
    }
});

// Update admin task
app.put('/api/v1/codex/admin-tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Build dynamic update query
        const setClauses = [];
        const params = [];
        let paramCount = 0;

        const allowedFields = ['title', 'description', 'task_type', 'priority', 'status', 'component', 'assigned_to', 'notes', 'resolution'];
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                params.push(updates[field]);
                setClauses.push(`${field} = $${++paramCount}`);
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        params.push(id);
        const query = `UPDATE admin_tasks SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${++paramCount} RETURNING *`;

        const result = await codexPool.query(query, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ task: result.rows[0] });
    } catch (err) {
        console.error('Error updating admin task:', err);
        res.status(500).json({ error: 'Failed to update task', message: err.message });
    }
});

// Delete admin task
app.delete('/api/v1/codex/admin-tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await codexPool.query('DELETE FROM admin_tasks WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ success: true, deleted: id });
    } catch (err) {
        console.error('Error deleting admin task:', err);
        res.status(500).json({ error: 'Failed to delete task', message: err.message });
    }
});

// Get distinct task components
app.get('/api/v1/codex/admin-tasks-components', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT DISTINCT component FROM admin_tasks
            WHERE component IS NOT NULL
            ORDER BY component
        `);
        res.json({ components: result.rows.map(r => r.component) });
    } catch (err) {
        console.error('Error fetching components:', err);
        res.status(500).json({ error: 'Failed to fetch components', message: err.message });
    }
});

// Get admin users (for task assignment)
app.get('/api/v1/codex/admin-users', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT id, display_name, email
            FROM users
            WHERE role = 'admin' AND is_active = true
            ORDER BY display_name
        `);
        res.json({ users: result.rows });
    } catch (err) {
        console.error('Error fetching admin users:', err);
        res.status(500).json({ error: 'Failed to fetch admin users', message: err.message });
    }
});

// =============================================================================
// iDNS (Inspire Domain Name System) API ROUTES
// =============================================================================

// Resolve inspire:// URL to public URL
app.get('/api/v1/idns/resolve', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ success: false, error: 'URL parameter is required' });
        }

        // Parse the inspire:// URL
        // Format: inspire://domain.type (e.g., inspire://jubileeverse.webspace)
        const urlLower = url.toLowerCase().trim();

        if (!urlLower.startsWith('inspire://')) {
            return res.status(400).json({ success: false, error: 'Invalid URL format. Must start with inspire://' });
        }

        const domainPart = urlLower.replace('inspire://', '');

        // Split domain and type (e.g., "jubileeverse.webspace" -> domain="jubileeverse", type="webspace")
        const lastDotIndex = domainPart.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return res.status(400).json({ success: false, error: 'Invalid URL format. Expected format: inspire://domain.type' });
        }

        const domain = domainPart.substring(0, lastDotIndex);
        const type = domainPart.substring(lastDotIndex + 1);

        // Build the domain_key for lookup
        // For webspace: "webspace/jubileeverse"
        // For other types: just the domain (e.g., "apostle", "baptist")
        let domainKey;
        if (type === 'webspace' || type === 'webs') {
            domainKey = `webspace/${domain}`;
        } else {
            domainKey = domain;
        }

        // Look up in idns_domains table
        const result = await codexPool.query(`
            SELECT domain_name as domain_key, domain_type, domain_name as display_name, mres, managed
            FROM idns_domains
            WHERE domain_name = $1 AND is_active = true
        `, [domainKey]);

        if (result.rows.length === 0) {
            // Try abbreviated type lookup (webs -> webspace, insp -> inspire, etc.)
            const typeAbbreviations = {
                'webs': 'webspace',
                'insp': 'inspire',
                'chur': 'church',
                'apos': 'apostle',
                'prop': 'prophet'
            };

            const expandedType = typeAbbreviations[type] || type;
            if (expandedType !== type && (expandedType === 'webspace')) {
                const expandedKey = `webspace/${domain}`;
                const expandedResult = await codexPool.query(`
                    SELECT domain_name as domain_key, domain_type, domain_name as display_name, mres, managed
                    FROM idns_domains
                    WHERE domain_name = $1 AND is_active = true
                `, [expandedKey]);

                if (expandedResult.rows.length > 0) {
                    const entry = expandedResult.rows[0];
                    return res.json({
                        success: true,
                        privateUrl: url,
                        resolvedUrl: entry.mres || `https://www.worldwidebibleweb.com/${entry.domain_type}/${domain}/`,
                        domainKey: entry.domain_key,
                        domainType: entry.domain_type,
                        displayName: entry.display_name,
                        managed: entry.managed
                    });
                }
            }

            return res.status(404).json({
                success: false,
                error: 'Domain not found in iDNS registry',
                privateUrl: url,
                domainKey: domainKey
            });
        }

        const entry = result.rows[0];

        res.json({
            success: true,
            privateUrl: url,
            resolvedUrl: entry.mres || `https://www.worldwidebibleweb.com/${entry.domain_type}/${domain}/`,
            domainKey: entry.domain_key,
            domainType: entry.domain_type,
            displayName: entry.display_name,
            managed: entry.managed
        });
    } catch (err) {
        console.error('iDNS resolve error:', err);
        res.status(500).json({ success: false, error: 'Failed to resolve URL', message: err.message });
    }
});

// Get all iDNS domain types
app.get('/api/v1/idns/types', async (req, res) => {
    try {
        const result = await codexPool.query(`
            SELECT DISTINCT domain_type, COUNT(*) as count
            FROM idns_domains
            WHERE is_active = true
            GROUP BY domain_type
            ORDER BY count DESC
        `);

        res.json({ types: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch domain types', message: err.message });
    }
});

// Get all iDNS domains (for browsing)
app.get('/api/v1/idns/domains', async (req, res) => {
    try {
        const { type, managed, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT domain_name as domain_key, domain_type, domain_name as display_name, mres, managed, metadata
            FROM idns_domains
            WHERE is_active = true
        `;
        const params = [];
        let paramIndex = 1;

        if (type) {
            query += ` AND domain_type = $${paramIndex++}`;
            params.push(type);
        }

        if (managed !== undefined) {
            query += ` AND managed = $${paramIndex++}`;
            params.push(managed === 'true');
        }

        query += ` ORDER BY domain_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await codexPool.query(query, params);

        res.json({ domains: result.rows, count: result.rows.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch domains', message: err.message });
    }
});

// Get single iDNS domain by key
app.get('/api/v1/idns/domains/:domainKey', async (req, res) => {
    try {
        const { domainKey } = req.params;

        const result = await codexPool.query(`
            SELECT id, domain_name as domain_key, domain_type, domain_name as display_name, mres, managed,
                   metadata, is_active, created_at, updated_at
            FROM idns_domains
            WHERE domain_name = $1
        `, [domainKey]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Domain not found', domainKey });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch domain', message: err.message });
    }
});

// Create new iDNS domain entry
app.post('/api/v1/idns/domains', async (req, res) => {
    try {
        const { domain_key, domain_type, mres, managed, metadata } = req.body;

        if (!domain_key) {
            return res.status(400).json({ error: 'domain_key is required' });
        }

        // Check if domain already exists
        const existing = await codexPool.query(
            'SELECT id FROM idns_domains WHERE domain_name = $1',
            [domain_key]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Domain already exists', domain_key });
        }

        const result = await codexPool.query(`
            INSERT INTO idns_domains (domain_name, domain_type, mres, managed, metadata, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING id, domain_name as domain_key, domain_type, mres, managed, created_at
        `, [
            domain_key,
            domain_type || inferDomainType(domain_key),
            mres || null,
            managed || false,
            metadata ? JSON.stringify(metadata) : '{}'
        ]);

        res.status(201).json({ success: true, domain: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create domain', message: err.message });
    }
});

// Update iDNS domain entry
app.put('/api/v1/idns/domains/:domainKey', async (req, res) => {
    try {
        const { domainKey } = req.params;
        const { domain_type, mres, managed, metadata, is_active } = req.body;

        // Check if domain exists
        const existing = await codexPool.query(
            'SELECT id FROM idns_domains WHERE domain_name = $1',
            [domainKey]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Domain not found', domainKey });
        }

        const result = await codexPool.query(`
            UPDATE idns_domains
            SET domain_type = COALESCE($2, domain_type),
                mres = $3,
                managed = COALESCE($4, managed),
                metadata = COALESCE($5, metadata),
                is_active = COALESCE($6, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE domain_name = $1
            RETURNING id, domain_name as domain_key, domain_type, mres, managed, is_active, updated_at
        `, [
            domainKey,
            domain_type,
            mres !== undefined ? mres : null,
            managed,
            metadata ? JSON.stringify(metadata) : null,
            is_active
        ]);

        res.json({ success: true, domain: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update domain', message: err.message });
    }
});

// Bulk update iDNS domains (for wwBibleweb.com config sync)
app.post('/api/v1/idns/sync', async (req, res) => {
    try {
        const { domains } = req.body;

        if (!domains || typeof domains !== 'object') {
            return res.status(400).json({ error: 'domains object is required' });
        }

        const client = await codexPool.connect();
        try {
            await client.query('BEGIN');

            let created = 0;
            let updated = 0;

            for (const [domainKey, data] of Object.entries(domains)) {
                const domainType = data.domain_type || inferDomainType(domainKey);

                const result = await client.query(`
                    INSERT INTO idns_domains (domain_name, domain_type, mres, managed, metadata, is_active)
                    VALUES ($1, $2, $3, $4, $5, true)
                    ON CONFLICT (domain_name) DO UPDATE SET
                        mres = EXCLUDED.mres,
                        managed = EXCLUDED.managed,
                        metadata = EXCLUDED.metadata,
                        is_active = true,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING (xmax = 0) as is_insert
                `, [
                    domainKey,
                    domainType,
                    data.mres || null,
                    data.managed || false,
                    JSON.stringify(data)
                ]);

                if (result.rows[0].is_insert) {
                    created++;
                } else {
                    updated++;
                }
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                created,
                updated,
                total: Object.keys(domains).length
            });
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to sync domains', message: err.message });
    }
});

// Delete iDNS domain entry (soft delete)
app.delete('/api/v1/idns/domains/:domainKey', async (req, res) => {
    try {
        const { domainKey } = req.params;
        const { hard } = req.query; // ?hard=true for permanent delete

        // Check if domain exists
        const existing = await codexPool.query(
            'SELECT id FROM idns_domains WHERE domain_name = $1',
            [domainKey]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Domain not found', domainKey });
        }

        if (hard === 'true') {
            await codexPool.query('DELETE FROM idns_domains WHERE domain_name = $1', [domainKey]);
            res.json({ success: true, message: 'Domain permanently deleted', domainKey });
        } else {
            await codexPool.query(
                'UPDATE idns_domains SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE domain_name = $1',
                [domainKey]
            );
            res.json({ success: true, message: 'Domain deactivated', domainKey });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete domain', message: err.message });
    }
});

// Helper functions for domain inference
function inferDomainType(domainKey) {
    const countries = [
        'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina', 'armenia',
        'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'barbados',
        'belarus', 'belgium', 'belize', 'benin', 'bhutan', 'bolivia', 'botswana', 'brazil',
        'brunei', 'bulgaria', 'cambodia', 'cameroon', 'canada', 'chad', 'chile', 'china',
        'colombia', 'comoros', 'croatia', 'cuba', 'cyprus', 'denmark', 'djibouti', 'dominica',
        'ecuador', 'egypt', 'eritrea', 'estonia', 'ethiopia', 'fiji', 'finland', 'france',
        'gabon', 'gambia', 'georgia', 'germany', 'ghana', 'greece', 'grenada', 'guatemala',
        'guinea', 'guyana', 'haiti', 'honduras', 'hungary', 'iceland', 'india', 'indonesia',
        'iran', 'iraq', 'ireland', 'israel', 'italy', 'jamaica', 'japan', 'jordan',
        'kazakhstan', 'kenya', 'kiribati', 'kosovo', 'kuwait', 'kyrgyzstan', 'laos', 'latvia',
        'lebanon', 'lesotho', 'liberia', 'libya', 'liechtenstein', 'lithuania', 'luxembourg',
        'madagascar', 'malawi', 'malaysia', 'maldives', 'mali', 'malta', 'mauritania',
        'mauritius', 'mexico', 'micronesia', 'moldova', 'monaco', 'mongolia', 'montenegro',
        'morocco', 'mozambique', 'myanmar', 'namibia', 'nauru', 'nepal', 'netherlands',
        'newzealand', 'nicaragua', 'nigeria', 'norway', 'oman', 'pakistan', 'palau',
        'palestine', 'panama', 'paraguay', 'peru', 'philippines', 'poland', 'portugal',
        'qatar', 'romania', 'russia', 'rwanda', 'samoa', 'senegal', 'serbia', 'seychelles',
        'singapore', 'slovakia', 'slovenia', 'somalia', 'spain', 'sudan', 'suriname',
        'sweden', 'switzerland', 'taiwan', 'tajikistan', 'tanzania', 'thailand', 'togo',
        'tonga', 'tunisia', 'turkey', 'turkmenistan', 'tuvalu', 'uganda', 'ukraine',
        'uruguay', 'uzbekistan', 'vanuatu', 'venezuela', 'vietnam', 'yemen', 'zambia',
        'zimbabwe', 'unitedstates', 'unitedkingdom', 'unitedarabemirates', 'southafrica',
        'southkorea', 'northkorea', 'saudiarabia', 'srilanka', 'papuanewguinea', 'hongkong'
    ];

    const ministryTopics = [
        'academy', 'bible', 'biblical', 'charity', 'children', 'church', 'coaching',
        'community', 'conference', 'discipleship', 'events', 'family', 'fellowship',
        'group', 'healing', 'inspire', 'kids', 'library', 'marriage', 'men', 'ministry',
        'mission', 'music', 'news', 'pastor', 'podcast', 'praise', 'prayer', 'prophet',
        'recovery', 'retreat', 'school', 'scriptural', 'sermon', 'serve', 'shepherd',
        'teacher', 'testimony', 'women', 'worship', 'youth', 'apostle', 'evangelist'
    ];

    const lowerKey = domainKey.toLowerCase();
    if (domainKey.includes('/')) return 'webspace';
    if (countries.includes(lowerKey)) return 'country';
    if (ministryTopics.includes(lowerKey)) return 'ministry';
    return 'denomination';
}

function generateDisplayName(domainKey) {
    if (domainKey.includes('/')) {
        const parts = domainKey.split('/');
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ');
    }
    const spaced = domainKey.replace(/([a-z])([A-Z])/g, '$1 $2');
    return spaced.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// =============================================================================
// WEBSITES API ROUTES - Two-Layer Architecture
// =============================================================================
// Websites are the actual built sites. Each website MUST reference an IDNS domain.
// A domain without a website is not publicly visible.

// Get all websites with their domain information
app.get('/api/v1/websites', async (req, res) => {
    try {
        const { status, environment, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT
                w.id, w.idns_domain_id, w.owner_id, w.status, w.site_title, w.site_description,
                w.config, w.theme_config, w.seo_config, w.environment, w.content_source,
                w.content_type, w.view_count, w.created_at, w.updated_at, w.published_at,
                d.domain_name, d.domain_type, d.protocol_type, d.mres AS masked_resolution
            FROM websites w
            INNER JOIN idns_domains d ON w.idns_domain_id = d.id
            WHERE w.deleted_at IS NULL AND d.is_active = true
        `;
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND w.status = $${paramIndex++}`;
            params.push(status);
        }

        if (environment) {
            query += ` AND w.environment = $${paramIndex++}`;
            params.push(environment);
        }

        query += ` ORDER BY d.domain_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await codexPool.query(query, params);

        // Get total count
        const countResult = await codexPool.query(`
            SELECT COUNT(*) FROM websites w
            INNER JOIN idns_domains d ON w.idns_domain_id = d.id
            WHERE w.deleted_at IS NULL AND d.is_active = true
        `);

        res.json({
            websites: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch websites', message: err.message });
    }
});

// Get website by domain name (primary lookup method)
app.get('/api/v1/websites/by-domain/:domainName', async (req, res) => {
    try {
        const { domainName } = req.params;
        const { environment } = req.query;

        let query = `
            SELECT
                w.id, w.idns_domain_id, w.owner_id, w.status, w.site_title, w.site_description,
                w.config, w.theme_config, w.seo_config, w.environment, w.content_source,
                w.content_type, w.view_count, w.created_at, w.updated_at, w.published_at,
                d.domain_name, d.domain_type, d.protocol_type, d.mres AS masked_resolution
            FROM websites w
            INNER JOIN idns_domains d ON w.idns_domain_id = d.id
            WHERE d.domain_name = $1 AND w.deleted_at IS NULL AND d.is_active = true
        `;
        const params = [domainName];

        if (environment) {
            query += ` AND w.environment = $2`;
            params.push(environment);
        }

        const result = await codexPool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Website not found',
                domainName,
                message: 'No active website exists for this domain'
            });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch website', message: err.message });
    }
});

// Get website by ID
app.get('/api/v1/websites/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await codexPool.query(`
            SELECT
                w.*, d.domain_name, d.domain_type, d.protocol_type, d.mres AS masked_resolution
            FROM websites w
            INNER JOIN idns_domains d ON w.idns_domain_id = d.id
            WHERE w.id = $1 AND w.deleted_at IS NULL
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Website not found', id });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch website', message: err.message });
    }
});

// Create a new website (requires valid IDNS domain)
app.post('/api/v1/websites', async (req, res) => {
    try {
        const {
            domain_name, // Can specify existing domain OR create new one
            idns_domain_id, // Or directly reference existing domain ID
            site_title,
            site_description,
            config,
            theme_config,
            seo_config,
            environment = 'WWBW',
            content_source,
            content_type = 'folder',
            status = 'DRAFT',
            owner_id
        } = req.body;

        const client = await codexPool.connect();
        try {
            await client.query('BEGIN');

            let domainId = idns_domain_id;

            // If domain_name provided but no idns_domain_id, look up or create the domain
            if (domain_name && !domainId) {
                // Check if domain exists
                const existingDomain = await client.query(
                    'SELECT id FROM idns_domains WHERE domain_name = $1 AND is_active = true',
                    [domain_name]
                );

                if (existingDomain.rows.length > 0) {
                    domainId = existingDomain.rows[0].id;
                } else {
                    // Create the domain entry as part of this transaction
                    const newDomain = await client.query(`
                        INSERT INTO idns_domains (domain_name, domain_type, protocol_type, is_active)
                        VALUES ($1, $2, $3, true)
                        RETURNING id
                    `, [domain_name, inferDomainType(domain_name), environment]);
                    domainId = newDomain.rows[0].id;
                }
            }

            if (!domainId) {
                throw new Error('Either domain_name or idns_domain_id is required');
            }

            // Check if website already exists for this domain + environment
            const existingWebsite = await client.query(
                'SELECT id FROM websites WHERE idns_domain_id = $1 AND environment = $2 AND deleted_at IS NULL',
                [domainId, environment]
            );

            if (existingWebsite.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    error: 'Website already exists',
                    message: 'A website already exists for this domain and environment',
                    existing_website_id: existingWebsite.rows[0].id
                });
            }

            // Create the website
            const result = await client.query(`
                INSERT INTO websites (
                    idns_domain_id, owner_id, status, site_title, site_description,
                    config, theme_config, seo_config, environment, content_source, content_type,
                    published_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `, [
                domainId,
                owner_id || null,
                status,
                site_title || null,
                site_description || null,
                config ? JSON.stringify(config) : '{}',
                theme_config ? JSON.stringify(theme_config) : '{}',
                seo_config ? JSON.stringify(seo_config) : '{}',
                environment,
                content_source || null,
                content_type,
                status === 'PUBLISHED' ? new Date() : null
            ]);

            await client.query('COMMIT');

            // Fetch complete website with domain info
            const website = await codexPool.query(`
                SELECT w.*, d.domain_name, d.domain_type, d.protocol_type
                FROM websites w
                INNER JOIN idns_domains d ON w.idns_domain_id = d.id
                WHERE w.id = $1
            `, [result.rows[0].id]);

            res.status(201).json({
                success: true,
                message: 'Website created successfully',
                website: website.rows[0]
            });

        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }
    } catch (err) {
        if (err.message.includes('required')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to create website', message: err.message });
    }
});

// Update website
app.put('/api/v1/websites/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            site_title,
            site_description,
            config,
            theme_config,
            seo_config,
            status,
            content_source,
            content_type
        } = req.body;

        // Check if website exists
        const existing = await codexPool.query(
            'SELECT id, status FROM websites WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Website not found', id });
        }

        // If transitioning to PUBLISHED, set published_at
        const wasPublished = existing.rows[0].status === 'PUBLISHED';
        const isBeingPublished = status === 'PUBLISHED' && !wasPublished;

        const result = await codexPool.query(`
            UPDATE websites SET
                site_title = COALESCE($2, site_title),
                site_description = COALESCE($3, site_description),
                config = COALESCE($4, config),
                theme_config = COALESCE($5, theme_config),
                seo_config = COALESCE($6, seo_config),
                status = COALESCE($7, status),
                content_source = COALESCE($8, content_source),
                content_type = COALESCE($9, content_type),
                published_at = CASE WHEN $10 THEN NOW() ELSE published_at END
            WHERE id = $1
            RETURNING *
        `, [
            id,
            site_title,
            site_description,
            config ? JSON.stringify(config) : null,
            theme_config ? JSON.stringify(theme_config) : null,
            seo_config ? JSON.stringify(seo_config) : null,
            status,
            content_source,
            content_type,
            isBeingPublished
        ]);

        res.json({ success: true, website: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update website', message: err.message });
    }
});

// Delete website (soft delete)
app.delete('/api/v1/websites/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { hard } = req.query; // ?hard=true for permanent delete

        // Check if website exists
        const existing = await codexPool.query(
            'SELECT id FROM websites WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Website not found', id });
        }

        if (hard === 'true') {
            await codexPool.query('DELETE FROM websites WHERE id = $1', [id]);
            res.json({ success: true, message: 'Website permanently deleted', id });
        } else {
            await codexPool.query(
                'UPDATE websites SET deleted_at = NOW(), status = $2 WHERE id = $1',
                [id, 'ARCHIVED']
            );
            res.json({ success: true, message: 'Website archived', id });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete website', message: err.message });
    }
});

// Publish website
app.post('/api/v1/websites/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await codexPool.query(`
            UPDATE websites SET
                status = 'PUBLISHED',
                published_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Website not found', id });
        }

        res.json({ success: true, message: 'Website published', website: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to publish website', message: err.message });
    }
});

// Unpublish website (set to draft)
app.post('/api/v1/websites/:id/unpublish', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await codexPool.query(`
            UPDATE websites SET status = 'DRAFT'
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Website not found', id });
        }

        res.json({ success: true, message: 'Website unpublished', website: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to unpublish website', message: err.message });
    }
});

// Get domain+website combined view (for routing/resolution)
app.get('/api/v1/websites/resolve/:domainName', async (req, res) => {
    try {
        const { domainName } = req.params;

        const result = await codexPool.query(`
            SELECT * FROM domain_websites
            WHERE domain_name = $1
        `, [domainName]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Domain not found',
                domainName,
                is_live: false
            });
        }

        const domain = result.rows[0];

        res.json({
            domain_name: domain.domain_name,
            domain_type: domain.domain_type,
            protocol_type: domain.protocol_type,
            is_live: domain.is_live,
            website: domain.website_id ? {
                id: domain.website_id,
                title: domain.site_title,
                status: domain.website_status,
                environment: domain.environment,
                content_source: domain.content_source,
                content_type: domain.content_type,
                published_at: domain.published_at
            } : null,
            masked_resolution: domain.masked_resolution
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to resolve domain', message: err.message });
    }
});

// Create domain AND website in one transaction (atomic operation)
app.post('/api/v1/websites/create-with-domain', async (req, res) => {
    try {
        const {
            domain_name,
            domain_type,
            protocol_type = 'WWBW',
            site_title,
            site_description,
            config,
            status = 'PUBLISHED',
            content_source,
            content_type = 'folder',
            owner_id
        } = req.body;

        if (!domain_name) {
            return res.status(400).json({ error: 'domain_name is required' });
        }

        const client = await codexPool.connect();
        try {
            await client.query('BEGIN');

            // Check if domain already exists
            const existingDomain = await client.query(
                'SELECT id FROM idns_domains WHERE domain_name = $1',
                [domain_name]
            );

            if (existingDomain.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    error: 'Domain already exists',
                    domain_name,
                    message: 'This domain name is already registered'
                });
            }

            // Create IDNS domain entry
            const domainResult = await client.query(`
                INSERT INTO idns_domains (domain_name, domain_type, protocol_type, owner_id, is_active)
                VALUES ($1, $2, $3, $4, true)
                RETURNING id
            `, [
                domain_name,
                domain_type || inferDomainType(domain_name),
                protocol_type,
                owner_id || null
            ]);

            const domainId = domainResult.rows[0].id;

            // Create website entry
            const websiteResult = await client.query(`
                INSERT INTO websites (
                    idns_domain_id, owner_id, status, site_title, site_description,
                    config, environment, content_source, content_type,
                    published_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                domainId,
                owner_id || null,
                status,
                site_title || domain_name,
                site_description || null,
                config ? JSON.stringify(config) : '{}',
                protocol_type,
                content_source || domain_name,
                content_type,
                status === 'PUBLISHED' ? new Date() : null
            ]);

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Domain and website created successfully',
                domain: {
                    id: domainId,
                    domain_name
                },
                website: websiteResult.rows[0]
            });

        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to create domain and website', message: err.message });
    }
});

// =============================================================================
// INSPIRE API ROUTES - Ministry Content
// =============================================================================

// Content Categories
app.get('/api/v1/inspire/categories', async (req, res) => {
    try {
        const result = await inspirePool.query(`
            SELECT id, name, slug, description, parent_id, sort_order, is_active
            FROM content_categories
            WHERE is_active = true
            ORDER BY sort_order, name
        `);

        res.json({ categories: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories', message: err.message });
    }
});

// Content Items
app.get('/api/v1/inspire/content', async (req, res) => {
    try {
        const { category_id, content_type, status = 'published', limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT id, category_id, title, slug, content_type, summary, author_id,
                   status, published_at, featured, view_count, created_at
            FROM content_items
            WHERE status = $1
        `;
        const params = [status];
        let paramCount = 1;

        if (category_id) {
            params.push(category_id);
            query += ` AND category_id = $${++paramCount}`;
        }
        if (content_type) {
            params.push(content_type);
            query += ` AND content_type = $${++paramCount}`;
        }

        params.push(parseInt(limit));
        params.push(parseInt(offset));
        query += ` ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;

        const result = await inspirePool.query(query, params);

        const countQuery = `SELECT COUNT(*) FROM content_items WHERE status = $1`;
        const countResult = await inspirePool.query(countQuery, [status]);

        res.json({
            content: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch content', message: err.message });
    }
});

app.get('/api/v1/inspire/content/:id', async (req, res) => {
    try {
        const result = await inspirePool.query(`
            SELECT * FROM content_items WHERE id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Increment view count
        await inspirePool.query(`
            UPDATE content_items SET view_count = view_count + 1 WHERE id = $1
        `, [req.params.id]);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch content', message: err.message });
    }
});

// Devotional Plans
app.get('/api/v1/inspire/devotionals', async (req, res) => {
    try {
        const result = await inspirePool.query(`
            SELECT id, title, description, duration_days, difficulty_level, topics, is_published
            FROM devotional_plans
            WHERE is_published = true
            ORDER BY title
        `);

        res.json({ devotionals: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch devotionals', message: err.message });
    }
});

app.get('/api/v1/inspire/devotionals/:id/days', async (req, res) => {
    try {
        const result = await inspirePool.query(`
            SELECT d.*, c.title as content_title, c.summary as content_summary
            FROM devotional_plan_days d
            LEFT JOIN content_items c ON d.content_id = c.id
            WHERE d.plan_id = $1
            ORDER BY d.day_number
        `, [req.params.id]);

        res.json({ days: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch devotional days', message: err.message });
    }
});

// Sermon Series
app.get('/api/v1/inspire/series', async (req, res) => {
    try {
        const result = await inspirePool.query(`
            SELECT id, title, description, start_date, end_date, is_active
            FROM sermon_series
            WHERE is_active = true
            ORDER BY start_date DESC
        `);

        res.json({ series: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch series', message: err.message });
    }
});

// Knowledge Base
app.get('/api/v1/inspire/knowledge', async (req, res) => {
    try {
        const { category, search, limit = 50 } = req.query;

        let query = `
            SELECT id, title, category, tags, source_type, created_at
            FROM knowledge_base
            WHERE is_active = true
        `;
        const params = [];
        let paramCount = 0;

        if (category) {
            params.push(category);
            query += ` AND category = $${++paramCount}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (title ILIKE $${++paramCount} OR content ILIKE $${paramCount})`;
        }

        params.push(parseInt(limit));
        query += ` ORDER BY created_at DESC LIMIT $${++paramCount}`;

        const result = await inspirePool.query(query, params);
        res.json({ articles: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch knowledge base', message: err.message });
    }
});

app.get('/api/v1/inspire/knowledge/:id', async (req, res) => {
    try {
        const result = await inspirePool.query(`
            SELECT * FROM knowledge_base WHERE id = $1 AND is_active = true
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch article', message: err.message });
    }
});

// =============================================================================
// AUTHENTICATION API ROUTES - JubileeSSO
// =============================================================================

const crypto = require('crypto');

// Helper function to hash password (matches JubileeVerse AuthService)
function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(32).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

// Helper function to verify password (matches JubileeVerse AuthService format: salt:hash)
function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const inputHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === inputHash;
}

// Helper function to generate JWT-like token (simple implementation)
function generateToken(userId) {
    const payload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'jubilee-secret-key')
        .update(base64Payload)
        .digest('hex');
    return `${base64Payload}.${signature}`;
}

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, rememberMe, deviceInfo } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user by email
        const result = await codexPool.query(
            'SELECT id, email, password_hash, display_name, avatar_url, role, is_active FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is disabled'
            });
        }

        // Verify password
        if (!verifyPassword(password, user.password_hash)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Generate tokens
        const accessToken = generateToken(user.id);
        const refreshToken = generateToken(user.id + '-refresh');

        // Update last login
        await codexPool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1',
            [user.id]
        );

        // Track device if deviceInfo is provided
        if (deviceInfo && deviceInfo.deviceId) {
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                            req.connection?.remoteAddress ||
                            req.socket?.remoteAddress || null;

            try {
                await codexPool.query(`
                    INSERT INTO user_devices (
                        user_id, device_id, device_name, device_type, platform, platform_version,
                        browser, browser_version, app_name, app_version, ip_address, last_ip_address,
                        is_current, login_count
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, TRUE, 1)
                    ON CONFLICT (user_id, device_id) DO UPDATE SET
                        device_name = COALESCE(EXCLUDED.device_name, user_devices.device_name),
                        platform = COALESCE(EXCLUDED.platform, user_devices.platform),
                        platform_version = COALESCE(EXCLUDED.platform_version, user_devices.platform_version),
                        browser = COALESCE(EXCLUDED.browser, user_devices.browser),
                        browser_version = COALESCE(EXCLUDED.browser_version, user_devices.browser_version),
                        app_name = COALESCE(EXCLUDED.app_name, user_devices.app_name),
                        app_version = COALESCE(EXCLUDED.app_version, user_devices.app_version),
                        last_ip_address = EXCLUDED.ip_address,
                        last_seen_at = NOW(),
                        is_current = TRUE,
                        login_count = user_devices.login_count + 1,
                        updated_at = NOW()
                `, [
                    user.id,
                    deviceInfo.deviceId,
                    deviceInfo.deviceName || null,
                    deviceInfo.deviceType || 'desktop',
                    deviceInfo.platform || null,
                    deviceInfo.platformVersion || null,
                    deviceInfo.browser || null,
                    deviceInfo.browserVersion || null,
                    deviceInfo.appName || 'JubileeBrowser',
                    deviceInfo.appVersion || null,
                    clientIp
                ]);

                // Mark other devices as not current for this user
                await codexPool.query(
                    'UPDATE user_devices SET is_current = FALSE WHERE user_id = $1 AND device_id != $2',
                    [user.id, deviceInfo.deviceId]
                );
            } catch (deviceErr) {
                console.error('Device tracking error (non-fatal):', deviceErr.message);
                // Don't fail login if device tracking fails
            }
        }

        // Create session record
        await codexPool.query(
            `INSERT INTO session (sid, sess, expire)
             VALUES ($1, $2, $3)
             ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
            [
                user.id,
                JSON.stringify({ userId: user.id, email: user.email }),
                new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000)
            ]
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                role: user.role
            },
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred during login'
        });
    }
});

// Get user devices endpoint
app.get('/api/auth/devices', async (req, res) => {
    try {
        // Get user ID from authorization header (simplified for now)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authorization required'
            });
        }

        const token = authHeader.substring(7);
        // Simple token validation - extract user ID from payload
        let userId;
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
            userId = payload.sub;
        } catch {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        const result = await codexPool.query(`
            SELECT
                device_id,
                device_name,
                device_type,
                platform,
                platform_version,
                app_name,
                app_version,
                is_trusted,
                is_current,
                first_seen_at,
                last_seen_at,
                login_count
            FROM user_devices
            WHERE user_id = $1
            ORDER BY last_seen_at DESC
        `, [userId]);

        res.json({
            success: true,
            devices: result.rows.map(d => ({
                deviceId: d.device_id,
                deviceName: d.device_name,
                deviceType: d.device_type,
                platform: d.platform,
                platformVersion: d.platform_version,
                appName: d.app_name,
                appVersion: d.app_version,
                isTrusted: d.is_trusted,
                isCurrent: d.is_current,
                firstSeenAt: d.first_seen_at,
                lastSeenAt: d.last_seen_at,
                loginCount: d.login_count
            }))
        });

    } catch (err) {
        console.error('Get devices error:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching devices'
        });
    }
});

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, displayName, fullName, username } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters'
            });
        }

        // Check if user already exists
        const existingUser = await codexPool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email already exists'
            });
        }

        // Hash password
        const passwordHash = hashPassword(password);

        // Determine display name from fullName, displayName, or email
        const finalDisplayName = displayName || fullName || email.split('@')[0];

        // Create user
        const result = await codexPool.query(
            `INSERT INTO users (id, email, password_hash, display_name, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'user', true, NOW(), NOW())
             RETURNING id, email, display_name, role`,
            [
                crypto.randomUUID(),
                email.toLowerCase(),
                passwordHash,
                finalDisplayName
            ]
        );

        const user = result.rows[0];

        // Create WWBW email address for the user
        let wwbwEmail = null;
        try {
            // Parse first and last name from fullName or displayName
            const nameParts = (fullName || finalDisplayName).trim().split(/\s+/);
            const firstName = nameParts[0] || 'User';
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : firstName;

            wwbwEmail = await createWwbwEmailForUser(user.id, firstName, lastName);
        } catch (wwbwErr) {
            console.error('Error creating WWBW email:', wwbwErr);
            // Don't fail registration if WWBW email creation fails
        }

        // Generate tokens
        const accessToken = generateToken(user.id);
        const refreshToken = generateToken(user.id + '-refresh');

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                role: user.role,
                wwbwEmail: wwbwEmail ? wwbwEmail.email_address : null
            },
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: 7 * 24 * 60 * 60
            }
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred during registration'
        });
    }
});

// Helper function to create WWBW email for a user
// All usernames are stored in lowercase for consistency
async function createWwbwEmailForUser(userId, firstName, lastName, domain = 'inspire.shema') {
    // Clean and format the base username in lowercase: firstname.lastname
    const cleanFirst = firstName.trim().replace(/[^a-zA-Z]/g, '').toLowerCase();
    const cleanLast = lastName.trim().replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (!cleanFirst || !cleanLast) {
        throw new Error('Invalid name for WWBW email');
    }

    const baseUsername = `${cleanFirst}.${cleanLast}`;

    // Check if the base username is available (no suffix needed)
    const existingResult = await codexPool.query(
        'SELECT COUNT(*) as count FROM wwbw_emails WHERE base_username = $1 AND domain = $2',
        [baseUsername, domain]
    );

    const existingCount = parseInt(existingResult.rows[0]?.count ?? '0', 10);

    let username, suffixNumber;

    if (existingCount === 0) {
        // Base username is available
        username = baseUsername;
        suffixNumber = null;
    } else {
        // Find the maximum suffix number currently in use for this base username
        const maxSuffixResult = await codexPool.query(
            'SELECT MAX(suffix_number) as max_suffix FROM wwbw_emails WHERE base_username = $1 AND domain = $2',
            [baseUsername, domain]
        );

        const maxSuffix = maxSuffixResult.rows[0]?.max_suffix;

        // If max is null, that means only the base (without suffix) exists, so start at 2
        // Otherwise increment the max suffix
        suffixNumber = maxSuffix === null ? 2 : maxSuffix + 1;
        username = `${baseUsername}${suffixNumber}`;
    }

    // Create the email record
    const result = await codexPool.query(
        `INSERT INTO wwbw_emails (user_id, username, domain, base_username, suffix_number, is_primary, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
         RETURNING *`,
        [userId, username, domain, baseUsername, suffixNumber]
    );

    return result.rows[0];
}

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            // Decode token to get user ID
            try {
                const [base64Payload] = token.split('.');
                const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
                // Delete session
                await codexPool.query('DELETE FROM session WHERE sid = $1', [payload.userId]);
            } catch (e) {
                // Token invalid, ignore
            }
        }

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ success: false, error: 'An error occurred during logout' });
    }
});

// Refresh token endpoint
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ success: false, error: 'Refresh token required' });
        }

        // Verify refresh token
        try {
            const [base64Payload, signature] = refreshToken.split('.');
            const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'jubilee-secret-key')
                .update(base64Payload)
                .digest('hex');

            if (signature !== expectedSignature) {
                return res.status(401).json({ success: false, error: 'Invalid refresh token' });
            }

            const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

            if (payload.exp < Date.now()) {
                return res.status(401).json({ success: false, error: 'Refresh token expired' });
            }

            const userId = payload.userId.replace('-refresh', '');

            // Get user
            const result = await codexPool.query(
                'SELECT id, email, display_name, avatar_url, role FROM users WHERE id = $1 AND is_active = true',
                [userId]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ success: false, error: 'User not found' });
            }

            const user = result.rows[0];

            // Generate new tokens
            const newAccessToken = generateToken(user.id);
            const newRefreshToken = generateToken(user.id + '-refresh');

            res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.display_name,
                    avatarUrl: user.avatar_url,
                    role: user.role
                },
                tokens: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresIn: 7 * 24 * 60 * 60
                }
            });

        } catch (e) {
            return res.status(401).json({ success: false, error: 'Invalid refresh token' });
        }

    } catch (err) {
        console.error('Token refresh error:', err);
        res.status(500).json({ success: false, error: 'An error occurred' });
    }
});

// Get current user endpoint
app.get('/api/auth/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const token = authHeader.substring(7);

        // Verify token
        const [base64Payload, signature] = token.split('.');
        const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'jubilee-secret-key')
            .update(base64Payload)
            .digest('hex');

        if (signature !== expectedSignature) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }

        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

        if (payload.exp < Date.now()) {
            return res.status(401).json({ success: false, error: 'Token expired' });
        }

        // Get user
        const result = await codexPool.query(
            'SELECT id, email, display_name, avatar_url, role, preferred_language FROM users WHERE id = $1 AND is_active = true',
            [payload.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        const user = result.rows[0];

        // Get WWBW email if exists
        let wwbwEmail = null;
        try {
            const wwbwResult = await codexPool.query(
                `SELECT username || '@' || domain as email_address, username, domain
                 FROM wwbw_emails WHERE user_id = $1 AND is_primary = TRUE AND is_active = TRUE`,
                [user.id]
            );
            if (wwbwResult.rows.length > 0) {
                wwbwEmail = wwbwResult.rows[0].email_address;
            }
        } catch (e) {
            // WWBW table might not exist yet, ignore error
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                role: user.role,
                preferredLanguage: user.preferred_language,
                wwbwEmail: wwbwEmail
            }
        });

    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ success: false, error: 'An error occurred' });
    }
});

// =============================================================================
// WWBW EMAIL API ROUTES
// =============================================================================

// Get user's WWBW email
app.get('/api/wwbw/email', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const [base64Payload, signature] = token.split('.');
        const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'jubilee-secret-key')
            .update(base64Payload)
            .digest('hex');

        if (signature !== expectedSignature) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }

        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

        if (payload.exp < Date.now()) {
            return res.status(401).json({ success: false, error: 'Token expired' });
        }

        const result = await codexPool.query(
            `SELECT id, username, domain, username || '@' || domain as email_address,
                    base_username, suffix_number, is_primary, is_active, created_at
             FROM wwbw_emails WHERE user_id = $1 AND is_primary = TRUE`,
            [payload.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No WWBW email found for this user'
            });
        }

        res.json({
            success: true,
            wwbwEmail: result.rows[0]
        });

    } catch (err) {
        console.error('Get WWBW email error:', err);
        res.status(500).json({ success: false, error: 'An error occurred' });
    }
});

// Change WWBW email username
app.put('/api/wwbw/email/username', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const [base64Payload, signature] = token.split('.');
        const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'jubilee-secret-key')
            .update(base64Payload)
            .digest('hex');

        if (signature !== expectedSignature) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }

        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

        if (payload.exp < Date.now()) {
            return res.status(401).json({ success: false, error: 'Token expired' });
        }

        const { newUsername } = req.body;

        if (!newUsername) {
            return res.status(400).json({
                success: false,
                error: 'New username is required'
            });
        }

        // Clean the new username (allow letters, numbers, dots, and underscores)
        const cleanUsername = newUsername.trim().replace(/[^a-zA-Z0-9._]/g, '');

        // Validate username length
        if (cleanUsername.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Username must be at least 3 characters'
            });
        }

        if (cleanUsername.length > 64) {
            return res.status(400).json({
                success: false,
                error: 'Username must be no more than 64 characters'
            });
        }

        // Get user's current WWBW email
        const currentEmail = await codexPool.query(
            'SELECT * FROM wwbw_emails WHERE user_id = $1 AND is_primary = TRUE',
            [payload.userId]
        );

        if (currentEmail.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No WWBW email found for this user'
            });
        }

        const wwbwEmail = currentEmail.rows[0];

        // Check if new username is available
        const conflictCheck = await codexPool.query(
            'SELECT id FROM wwbw_emails WHERE username = $1 AND domain = $2 AND id != $3',
            [cleanUsername, wwbwEmail.domain, wwbwEmail.id]
        );

        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: `Username "${cleanUsername}" is already taken`
            });
        }

        // Record the change in history
        await codexPool.query(
            `INSERT INTO wwbw_email_history (wwbw_email_id, user_id, old_username, new_username, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [wwbwEmail.id, payload.userId, wwbwEmail.username, cleanUsername, payload.userId]
        );

        // Update the email record
        const result = await codexPool.query(
            `UPDATE wwbw_emails
             SET username = $1, base_username = $1, suffix_number = NULL, updated_at = NOW()
             WHERE id = $2
             RETURNING id, username, domain, username || '@' || domain as email_address,
                       base_username, suffix_number, is_primary, is_active`,
            [cleanUsername, wwbwEmail.id]
        );

        res.json({
            success: true,
            message: 'WWBW email username updated successfully',
            wwbwEmail: result.rows[0]
        });

    } catch (err) {
        console.error('Change WWBW username error:', err);
        res.status(500).json({ success: false, error: 'An error occurred' });
    }
});

// Check if a WWBW username is available
app.get('/api/wwbw/username/check', async (req, res) => {
    try {
        const { username, domain = 'inspire.shema' } = req.query;

        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Username is required'
            });
        }

        const cleanUsername = username.trim().replace(/[^a-zA-Z0-9._]/g, '');

        const result = await codexPool.query(
            'SELECT id FROM wwbw_emails WHERE username = $1 AND domain = $2',
            [cleanUsername, domain]
        );

        res.json({
            success: true,
            available: result.rows.length === 0,
            username: cleanUsername,
            domain: domain
        });

    } catch (err) {
        console.error('Check WWBW username error:', err);
        res.status(500).json({ success: false, error: 'An error occurred' });
    }
});

// =============================================================================
// BROWSER SYNC API ROUTES
// =============================================================================

// Middleware to verify token and get user ID
async function authenticateToken(req, res, next) {
    console.log('[AUTH] Authenticating request to:', req.path);
    // Support both Authorization header and query parameter (for clients behind proxies)
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
        console.log('[AUTH] Token from Authorization header');
    } else if (req.query.access_token) {
        token = req.query.access_token;
        console.log('[AUTH] Token from query parameter');
    }

    if (!token) {
        console.log('[AUTH] No Authorization header, Bearer prefix, or access_token query parameter');
        return res.status(401).json({ success: false, error: 'Authorization required' });
    }

    console.log('[AUTH] Token received (first 30 chars):', token.substring(0, 30) + '...');

    try {
        const [base64Payload, signature] = token.split('.');
        if (!base64Payload || !signature) {
            console.log('[AUTH] Invalid token format - missing parts');
            return res.status(401).json({ success: false, error: 'Invalid token format' });
        }

        const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'jubilee-secret-key')
            .update(base64Payload)
            .digest('hex');

        console.log('[AUTH] Expected sig:', expectedSignature.substring(0, 20) + '...');
        console.log('[AUTH] Received sig:', signature.substring(0, 20) + '...');

        if (signature !== expectedSignature) {
            console.log('[AUTH] Signature mismatch!');
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }

        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
        console.log('[AUTH] Token payload:', JSON.stringify(payload));

        if (payload.exp < Date.now()) {
            console.log('[AUTH] Token expired. exp:', payload.exp, 'now:', Date.now());
            return res.status(401).json({ success: false, error: 'Token expired' });
        }

        req.userId = payload.userId;
        console.log('[AUTH] Authenticated user:', req.userId);
        next();
    } catch (e) {
        console.log('[AUTH] Token parse error:', e.message);
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
}

// Push sync changes from client
app.post('/api/sync/push', authenticateToken, async (req, res) => {
    try {
        const { deviceId, timestamp, changes } = req.body;
        const userId = req.userId;

        if (!deviceId || !changes || !Array.isArray(changes)) {
            return res.status(400).json({
                success: false,
                error: 'deviceId and changes array are required'
            });
        }

        let processed = 0;
        let failed = 0;

        for (const change of changes) {
            try {
                const { entityType, entityId, changeType, data, timestamp: clientTimestamp } = change;

                if (changeType === 'delete') {
                    // Mark as deleted
                    await codexPool.query(`
                        INSERT INTO browser_sync_data (user_id, device_id, entity_type, entity_id, change_type, data, client_timestamp, is_deleted)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
                        ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
                            device_id = EXCLUDED.device_id,
                            change_type = EXCLUDED.change_type,
                            data = EXCLUDED.data,
                            client_timestamp = EXCLUDED.client_timestamp,
                            is_deleted = TRUE,
                            version = browser_sync_data.version + 1,
                            updated_at = NOW()
                    `, [userId, deviceId, entityType, entityId, changeType, data ? JSON.stringify(data) : null, clientTimestamp || Date.now()]);
                } else {
                    // Create or update
                    await codexPool.query(`
                        INSERT INTO browser_sync_data (user_id, device_id, entity_type, entity_id, change_type, data, client_timestamp)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
                            device_id = EXCLUDED.device_id,
                            change_type = EXCLUDED.change_type,
                            data = EXCLUDED.data,
                            client_timestamp = EXCLUDED.client_timestamp,
                            is_deleted = FALSE,
                            version = browser_sync_data.version + 1,
                            updated_at = NOW()
                    `, [userId, deviceId, entityType, entityId, changeType, data ? JSON.stringify(data) : null, clientTimestamp || Date.now()]);
                }
                processed++;
            } catch (err) {
                console.error('Sync push error for change:', change, err);
                failed++;
            }
        }

        // Update last sync time in preferences
        await codexPool.query(`
            INSERT INTO browser_sync_preferences (user_id, last_sync_at)
            VALUES ($1, NOW())
            ON CONFLICT (user_id) DO UPDATE SET last_sync_at = NOW()
        `, [userId]);

        res.json({
            success: true,
            processed,
            failed,
            serverTimestamp: Date.now()
        });

    } catch (err) {
        console.error('Sync push error:', err);
        res.status(500).json({ success: false, error: 'Failed to push sync data' });
    }
});

// Pull sync changes for client
app.get('/api/sync/pull', authenticateToken, async (req, res) => {
    console.log('[SYNC PULL] Request received for user:', req.userId, 'since:', req.query.since, 'device:', req.query.device_id);
    try {
        const { since, device_id: deviceId } = req.query;
        const userId = req.userId;

        const sinceTimestamp = since ? new Date(parseInt(since)) : new Date(0);

        // Get changes since the given timestamp, excluding changes from the requesting device
        const result = await codexPool.query(`
            SELECT
                entity_type as "entityType",
                entity_id as "entityId",
                change_type as "changeType",
                data,
                client_timestamp as "timestamp",
                is_deleted as "isDeleted",
                version
            FROM browser_sync_data
            WHERE user_id = $1
              AND server_timestamp > $2
              AND (device_id != $3 OR $3 IS NULL)
            ORDER BY server_timestamp ASC
            LIMIT 1000
        `, [userId, sinceTimestamp, deviceId || null]);

        // Parse JSON data for each row
        const changes = result.rows.map(row => ({
            ...row,
            data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null
        }));

        res.json({
            success: true,
            changes,
            serverTimestamp: Date.now()
        });

    } catch (err) {
        console.error('Sync pull error:', err);
        res.status(500).json({ success: false, error: 'Failed to pull sync data' });
    }
});

// Get sync preferences
app.get('/api/sync/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        const result = await codexPool.query(`
            SELECT
                sync_bookmarks as "syncBookmarks",
                sync_history as "syncHistory",
                sync_passwords as "syncPasswords",
                sync_autofill as "syncAutofill",
                sync_extensions as "syncExtensions",
                sync_themes as "syncThemes",
                sync_settings as "syncSettings",
                last_sync_at as "lastSyncAt"
            FROM browser_sync_preferences
            WHERE user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            // Return defaults
            return res.json({
                success: true,
                preferences: {
                    syncBookmarks: true,
                    syncHistory: true,
                    syncPasswords: false,
                    syncAutofill: false,
                    syncExtensions: false,
                    syncThemes: true,
                    syncSettings: true,
                    lastSyncAt: null
                }
            });
        }

        res.json({
            success: true,
            preferences: result.rows[0]
        });

    } catch (err) {
        console.error('Get sync preferences error:', err);
        res.status(500).json({ success: false, error: 'Failed to get sync preferences' });
    }
});

// Update sync preferences
app.put('/api/sync/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const {
            syncBookmarks = true,
            syncHistory = true,
            syncPasswords = false,
            syncAutofill = false,
            syncExtensions = false,
            syncThemes = true,
            syncSettings = true
        } = req.body;

        await codexPool.query(`
            INSERT INTO browser_sync_preferences (user_id, sync_bookmarks, sync_history, sync_passwords, sync_autofill, sync_extensions, sync_themes, sync_settings)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id) DO UPDATE SET
                sync_bookmarks = EXCLUDED.sync_bookmarks,
                sync_history = EXCLUDED.sync_history,
                sync_passwords = EXCLUDED.sync_passwords,
                sync_autofill = EXCLUDED.sync_autofill,
                sync_extensions = EXCLUDED.sync_extensions,
                sync_themes = EXCLUDED.sync_themes,
                sync_settings = EXCLUDED.sync_settings,
                updated_at = NOW()
        `, [userId, syncBookmarks, syncHistory, syncPasswords, syncAutofill, syncExtensions, syncThemes, syncSettings]);

        res.json({
            success: true,
            message: 'Sync preferences updated'
        });

    } catch (err) {
        console.error('Update sync preferences error:', err);
        res.status(500).json({ success: false, error: 'Failed to update sync preferences' });
    }
});

// Get sync status
app.get('/api/sync/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        // Get counts by entity type
        const countsResult = await codexPool.query(`
            SELECT
                entity_type,
                COUNT(*) as count,
                MAX(server_timestamp) as last_updated
            FROM browser_sync_data
            WHERE user_id = $1 AND is_deleted = FALSE
            GROUP BY entity_type
        `, [userId]);

        // Get last sync time
        const prefsResult = await codexPool.query(`
            SELECT last_sync_at FROM browser_sync_preferences WHERE user_id = $1
        `, [userId]);

        const counts = {};
        countsResult.rows.forEach(row => {
            counts[row.entity_type] = {
                count: parseInt(row.count),
                lastUpdated: row.last_updated
            };
        });

        res.json({
            success: true,
            status: {
                entityCounts: counts,
                lastSyncAt: prefsResult.rows[0]?.last_sync_at || null,
                serverTime: new Date().toISOString()
            }
        });

    } catch (err) {
        console.error('Get sync status error:', err);
        res.status(500).json({ success: false, error: 'Failed to get sync status' });
    }
});

// =============================================================================
// CHROMIUM-STYLE SYNC API V2 - Collection-based versioned sync
// =============================================================================

// Register/update device for sync
app.post('/api/sync/v2/devices/register', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { deviceId, deviceName, deviceType, platform, platformVersion, appName, appVersion } = req.body;

        if (!deviceId) {
            return res.status(400).json({ success: false, error: 'deviceId is required' });
        }

        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                        req.connection?.remoteAddress ||
                        req.socket?.remoteAddress || null;

        // Upsert device
        const result = await codexPool.query(`
            INSERT INTO user_devices (
                user_id, device_id, device_name, device_type, platform, platform_version,
                app_name, app_version, ip_address, last_ip_address, is_current
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, TRUE)
            ON CONFLICT (user_id, device_id) DO UPDATE SET
                device_name = COALESCE(EXCLUDED.device_name, user_devices.device_name),
                device_type = COALESCE(EXCLUDED.device_type, user_devices.device_type),
                platform = COALESCE(EXCLUDED.platform, user_devices.platform),
                platform_version = COALESCE(EXCLUDED.platform_version, user_devices.platform_version),
                app_name = COALESCE(EXCLUDED.app_name, user_devices.app_name),
                app_version = COALESCE(EXCLUDED.app_version, user_devices.app_version),
                last_ip_address = $9,
                last_seen_at = NOW(),
                is_current = TRUE,
                login_count = user_devices.login_count + 1,
                updated_at = NOW()
            RETURNING id, device_id, device_name, created_at
        `, [userId, deviceId, deviceName || 'Unknown Device', deviceType || 'desktop',
            platform, platformVersion, appName || 'JubileeBrowser', appVersion, clientIp]);

        const device = result.rows[0];

        // Initialize sync collections for this user if they don't exist
        const collectionTypes = ['bookmarks', 'history', 'passwords', 'autofill', 'settings', 'tabs'];
        for (const collType of collectionTypes) {
            await codexPool.query(`
                INSERT INTO sync_collections (user_id, collection_type, is_enabled)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, collection_type) DO NOTHING
            `, [userId, collType, collType !== 'passwords']); // passwords disabled by default
        }

        // Get all collections for this user
        const collections = await codexPool.query(`
            SELECT id, collection_type, current_version, is_enabled
            FROM sync_collections WHERE user_id = $1
        `, [userId]);

        res.json({
            success: true,
            device: {
                id: device.id,
                deviceId: device.device_id,
                deviceName: device.device_name,
                registeredAt: device.created_at
            },
            collections: collections.rows.map(c => ({
                id: c.id,
                type: c.collection_type,
                currentVersion: parseInt(c.current_version),
                enabled: c.is_enabled
            }))
        });

    } catch (err) {
        console.error('Device registration error:', err);
        res.status(500).json({ success: false, error: 'Failed to register device' });
    }
});

// Get collection versions (for initial sync handshake)
app.get('/api/sync/v2/collections', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        const result = await codexPool.query(`
            SELECT id, collection_type, current_version, is_enabled, encryption_key_id, updated_at
            FROM sync_collections WHERE user_id = $1
        `, [userId]);

        res.json({
            success: true,
            collections: result.rows.map(c => ({
                id: c.id,
                type: c.collection_type,
                currentVersion: parseInt(c.current_version),
                enabled: c.is_enabled,
                encryptionKeyId: c.encryption_key_id,
                updatedAt: c.updated_at
            })),
            serverTime: Date.now()
        });

    } catch (err) {
        console.error('Get collections error:', err);
        res.status(500).json({ success: false, error: 'Failed to get collections' });
    }
});

// Commit changes to a collection (push)
app.post('/api/sync/v2/collections/:collectionType/commit', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { collectionType } = req.params;
        const { deviceId, items, baseVersion } = req.body;

        if (!deviceId || !items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, error: 'deviceId and items array are required' });
        }

        // Get collection
        const collResult = await codexPool.query(`
            SELECT id, current_version FROM sync_collections
            WHERE user_id = $1 AND collection_type = $2
        `, [userId, collectionType]);

        if (collResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        const collection = collResult.rows[0];
        const currentVersion = parseInt(collection.current_version);

        // Check for conflicts (if baseVersion is provided and doesn't match)
        if (baseVersion !== undefined && baseVersion < currentVersion) {
            // There are newer changes - return them for conflict resolution
            const newerItems = await codexPool.query(`
                SELECT client_id, server_version, payload, is_deleted
                FROM sync_items
                WHERE collection_id = $1 AND server_version > $2
                ORDER BY server_version ASC
            `, [collection.id, baseVersion]);

            return res.status(409).json({
                success: false,
                error: 'Conflict detected',
                currentVersion,
                baseVersion,
                conflictingItems: newerItems.rows.map(i => ({
                    clientId: i.client_id,
                    serverVersion: parseInt(i.server_version),
                    payload: i.payload,
                    isDeleted: i.is_deleted
                }))
            });
        }

        // Get device ID from database
        const deviceResult = await codexPool.query(`
            SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2
        `, [userId, deviceId]);

        const deviceDbId = deviceResult.rows.length > 0 ? deviceResult.rows[0].id : null;

        // Process items
        const committedItems = [];
        for (const item of items) {
            const { clientId, payload, isDeleted = false, isEncrypted = false } = item;

            if (!clientId) continue;

            // Use the upsert function
            const insertResult = await codexPool.query(`
                SELECT * FROM upsert_sync_item($1, $2, $3, $4, $5, $6)
            `, [collection.id, clientId, payload || {}, deviceDbId, isEncrypted, isDeleted]);

            committedItems.push({
                clientId,
                serverVersion: parseInt(insertResult.rows[0].new_version),
                itemId: insertResult.rows[0].item_id
            });
        }

        // Get new collection version
        const newVersionResult = await codexPool.query(`
            SELECT current_version FROM sync_collections WHERE id = $1
        `, [collection.id]);

        res.json({
            success: true,
            collectionType,
            newVersion: parseInt(newVersionResult.rows[0].current_version),
            committedItems,
            serverTime: Date.now()
        });

    } catch (err) {
        console.error('Commit error:', err);
        res.status(500).json({ success: false, error: 'Failed to commit changes' });
    }
});

// Get updates from a collection (pull)
app.get('/api/sync/v2/collections/:collectionType/updates', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { collectionType } = req.params;
        const { sinceVersion = 0, limit = 100 } = req.query;

        // Get collection
        const collResult = await codexPool.query(`
            SELECT id, current_version FROM sync_collections
            WHERE user_id = $1 AND collection_type = $2
        `, [userId, collectionType]);

        if (collResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        const collection = collResult.rows[0];

        // Get items since version
        const result = await codexPool.query(`
            SELECT * FROM get_sync_items_since_version($1, $2, $3)
        `, [collection.id, parseInt(sinceVersion), parseInt(limit)]);

        const hasMore = result.rows.length === parseInt(limit);

        res.json({
            success: true,
            collectionType,
            currentVersion: parseInt(collection.current_version),
            sinceVersion: parseInt(sinceVersion),
            items: result.rows.map(i => ({
                itemId: i.item_id,
                clientId: i.client_id,
                serverVersion: parseInt(i.server_version),
                payload: i.payload,
                isEncrypted: i.is_encrypted,
                isDeleted: i.is_deleted,
                modifiedAt: i.client_modified_at
            })),
            hasMore,
            serverTime: Date.now()
        });

    } catch (err) {
        console.error('Get updates error:', err);
        res.status(500).json({ success: false, error: 'Failed to get updates' });
    }
});

// Acknowledge sync progress
app.post('/api/sync/v2/collections/:collectionType/acknowledge', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { collectionType } = req.params;
        const { deviceId, acknowledgedVersion } = req.body;

        if (!deviceId || acknowledgedVersion === undefined) {
            return res.status(400).json({ success: false, error: 'deviceId and acknowledgedVersion are required' });
        }

        // Get collection and device
        const collResult = await codexPool.query(`
            SELECT id FROM sync_collections WHERE user_id = $1 AND collection_type = $2
        `, [userId, collectionType]);

        const deviceResult = await codexPool.query(`
            SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2
        `, [userId, deviceId]);

        if (collResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Device not found' });
        }

        // Update or insert sync progress
        await codexPool.query(`
            INSERT INTO sync_progress (device_id, collection_id, last_acknowledged_version, last_sync_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (device_id, collection_id) DO UPDATE SET
                last_acknowledged_version = GREATEST(sync_progress.last_acknowledged_version, EXCLUDED.last_acknowledged_version),
                last_sync_at = NOW(),
                updated_at = NOW()
        `, [deviceResult.rows[0].id, collResult.rows[0].id, acknowledgedVersion]);

        res.json({
            success: true,
            collectionType,
            acknowledgedVersion: parseInt(acknowledgedVersion),
            serverTime: Date.now()
        });

    } catch (err) {
        console.error('Acknowledge error:', err);
        res.status(500).json({ success: false, error: 'Failed to acknowledge sync' });
    }
});

// Get sync progress for a device
app.get('/api/sync/v2/devices/:deviceId/progress', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { deviceId } = req.params;

        // Get device
        const deviceResult = await codexPool.query(`
            SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2
        `, [userId, deviceId]);

        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Device not found' });
        }

        // Get progress for all collections
        const result = await codexPool.query(`
            SELECT
                sc.collection_type,
                sc.current_version,
                COALESCE(sp.last_acknowledged_version, 0) as last_acknowledged_version,
                sp.last_sync_at
            FROM sync_collections sc
            LEFT JOIN sync_progress sp ON sp.collection_id = sc.id AND sp.device_id = $1
            WHERE sc.user_id = $2
        `, [deviceResult.rows[0].id, userId]);

        res.json({
            success: true,
            deviceId,
            progress: result.rows.map(p => ({
                collectionType: p.collection_type,
                currentVersion: parseInt(p.current_version),
                lastAcknowledgedVersion: parseInt(p.last_acknowledged_version),
                pendingUpdates: parseInt(p.current_version) - parseInt(p.last_acknowledged_version),
                lastSyncAt: p.last_sync_at
            })),
            serverTime: Date.now()
        });

    } catch (err) {
        console.error('Get progress error:', err);
        res.status(500).json({ success: false, error: 'Failed to get sync progress' });
    }
});

// Full sync endpoint - get all data for a collection
app.get('/api/sync/v2/collections/:collectionType/full', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { collectionType } = req.params;

        // Get collection
        const collResult = await codexPool.query(`
            SELECT id, current_version FROM sync_collections
            WHERE user_id = $1 AND collection_type = $2
        `, [userId, collectionType]);

        if (collResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        const collection = collResult.rows[0];

        // Get all non-deleted items
        const result = await codexPool.query(`
            SELECT
                id as item_id,
                client_id,
                server_version,
                payload,
                is_encrypted,
                client_modified_at
            FROM sync_items
            WHERE collection_id = $1 AND is_deleted = FALSE
            ORDER BY server_version ASC
        `, [collection.id]);

        res.json({
            success: true,
            collectionType,
            currentVersion: parseInt(collection.current_version),
            items: result.rows.map(i => ({
                itemId: i.item_id,
                clientId: i.client_id,
                serverVersion: parseInt(i.server_version),
                payload: i.payload,
                isEncrypted: i.is_encrypted,
                modifiedAt: i.client_modified_at
            })),
            totalCount: result.rows.length,
            serverTime: Date.now()
        });

    } catch (err) {
        console.error('Full sync error:', err);
        res.status(500).json({ success: false, error: 'Failed to get full sync data' });
    }
});

// =============================================================================
// ACCOUNT MANAGEMENT API ROUTES
// =============================================================================

// Get full account details with devices and sync info
app.get('/api/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        // Get user info
        const userResult = await codexPool.query(`
            SELECT id, email, display_name, avatar_url, role, preferred_language, created_at, last_login_at
            FROM users WHERE id = $1 AND is_active = true
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Get devices
        const devicesResult = await codexPool.query(`
            SELECT id, device_id, device_name, device_type, platform, platform_version,
                   browser, browser_version, app_name, app_version, is_trusted, is_current,
                   first_seen_at, last_seen_at, login_count
            FROM user_devices
            WHERE user_id = $1
            ORDER BY last_seen_at DESC
        `, [userId]);

        // Get sync preferences
        const prefsResult = await codexPool.query(`
            SELECT sync_bookmarks, sync_history, sync_passwords, sync_autofill,
                   sync_extensions, sync_themes, sync_settings, last_sync_at
            FROM browser_sync_preferences WHERE user_id = $1
        `, [userId]);

        // Get sync status per collection
        const syncStatusResult = await codexPool.query(`
            SELECT collection_type, server_version, updated_at
            FROM sync_collections WHERE user_id = $1
        `, [userId]);

        res.json({
            success: true,
            account: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                role: user.role,
                preferredLanguage: user.preferred_language,
                createdAt: user.created_at,
                lastLoginAt: user.last_login_at
            },
            devices: devicesResult.rows.map(d => ({
                id: d.id,
                deviceId: d.device_id,
                deviceName: d.device_name,
                deviceType: d.device_type,
                platform: d.platform,
                platformVersion: d.platform_version,
                browser: d.browser,
                browserVersion: d.browser_version,
                appName: d.app_name,
                appVersion: d.app_version,
                isTrusted: d.is_trusted,
                isCurrent: d.is_current,
                firstSeenAt: d.first_seen_at,
                lastSeenAt: d.last_seen_at,
                loginCount: d.login_count
            })),
            syncPreferences: prefsResult.rows.length > 0 ? {
                syncBookmarks: prefsResult.rows[0].sync_bookmarks,
                syncHistory: prefsResult.rows[0].sync_history,
                syncPasswords: prefsResult.rows[0].sync_passwords,
                syncAutofill: prefsResult.rows[0].sync_autofill,
                syncExtensions: prefsResult.rows[0].sync_extensions,
                syncThemes: prefsResult.rows[0].sync_themes,
                syncSettings: prefsResult.rows[0].sync_settings,
                lastSyncAt: prefsResult.rows[0].last_sync_at
            } : {
                syncBookmarks: true,
                syncHistory: true,
                syncPasswords: false,
                syncAutofill: false,
                syncExtensions: false,
                syncThemes: true,
                syncSettings: true,
                lastSyncAt: null
            },
            syncCollections: syncStatusResult.rows.map(c => ({
                collectionType: c.collection_type,
                serverVersion: c.server_version,
                updatedAt: c.updated_at
            }))
        });

    } catch (err) {
        console.error('Get account error:', err);
        res.status(500).json({ success: false, error: 'Failed to get account details' });
    }
});

// Update account profile
app.put('/api/account/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { displayName, avatarUrl, preferredLanguage } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (displayName !== undefined) {
            updates.push(`display_name = $${paramIndex++}`);
            values.push(displayName);
        }
        if (avatarUrl !== undefined) {
            updates.push(`avatar_url = $${paramIndex++}`);
            values.push(avatarUrl);
        }
        if (preferredLanguage !== undefined) {
            updates.push(`preferred_language = $${paramIndex++}`);
            values.push(preferredLanguage);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(userId);

        await codexPool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        res.json({ success: true, message: 'Profile updated' });

    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

// Change password
app.put('/api/account/password', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current and new password required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        // Verify current password
        const userResult = await codexPool.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        // Hash and update new password
        const newHash = await bcrypt.hash(newPassword, 12);
        await codexPool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHash, userId]
        );

        res.json({ success: true, message: 'Password changed successfully' });

    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ success: false, error: 'Failed to change password' });
    }
});

// Get connected devices
app.get('/api/account/devices', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        const result = await codexPool.query(`
            SELECT id, device_id, device_name, device_type, platform, platform_version,
                   browser, browser_version, app_name, app_version, is_trusted, is_current,
                   first_seen_at, last_seen_at, login_count, last_ip_address
            FROM user_devices
            WHERE user_id = $1
            ORDER BY last_seen_at DESC
        `, [userId]);

        res.json({
            success: true,
            devices: result.rows.map(d => ({
                id: d.id,
                deviceId: d.device_id,
                deviceName: d.device_name || `${d.platform || 'Unknown'} ${d.device_type}`,
                deviceType: d.device_type,
                platform: d.platform,
                platformVersion: d.platform_version,
                browser: d.browser,
                browserVersion: d.browser_version,
                appName: d.app_name,
                appVersion: d.app_version,
                isTrusted: d.is_trusted,
                isCurrent: d.is_current,
                firstSeenAt: d.first_seen_at,
                lastSeenAt: d.last_seen_at,
                loginCount: d.login_count,
                lastIpAddress: d.last_ip_address
            }))
        });

    } catch (err) {
        console.error('Get devices error:', err);
        res.status(500).json({ success: false, error: 'Failed to get devices' });
    }
});

// Remove a device
app.delete('/api/account/devices/:deviceId', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { deviceId } = req.params;

        // Delete the device (cascades to sync_progress, etc.)
        const result = await codexPool.query(
            'DELETE FROM user_devices WHERE user_id = $1 AND id = $2 RETURNING id',
            [userId, deviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Device not found' });
        }

        res.json({ success: true, message: 'Device removed' });

    } catch (err) {
        console.error('Remove device error:', err);
        res.status(500).json({ success: false, error: 'Failed to remove device' });
    }
});

// Trust/untrust a device
app.put('/api/account/devices/:deviceId/trust', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { deviceId } = req.params;
        const { trusted } = req.body;

        const result = await codexPool.query(
            'UPDATE user_devices SET is_trusted = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3 RETURNING id',
            [trusted === true, userId, deviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Device not found' });
        }

        res.json({ success: true, message: trusted ? 'Device trusted' : 'Device untrusted' });

    } catch (err) {
        console.error('Trust device error:', err);
        res.status(500).json({ success: false, error: 'Failed to update device trust' });
    }
});

// Rename a device
app.put('/api/account/devices/:deviceId/name', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { deviceId } = req.params;
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Device name required' });
        }

        const result = await codexPool.query(
            'UPDATE user_devices SET device_name = $1, updated_at = NOW() WHERE user_id = $2 AND id = $3 RETURNING id',
            [name.trim(), userId, deviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Device not found' });
        }

        res.json({ success: true, message: 'Device renamed' });

    } catch (err) {
        console.error('Rename device error:', err);
        res.status(500).json({ success: false, error: 'Failed to rename device' });
    }
});

// Sign out from all devices
app.post('/api/account/signout-all', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { exceptCurrent } = req.body;
        const currentDeviceId = req.query.device_id;

        if (exceptCurrent && currentDeviceId) {
            // Delete all devices except the current one
            await codexPool.query(
                'DELETE FROM user_devices WHERE user_id = $1 AND device_id != $2',
                [userId, currentDeviceId]
            );
        } else {
            // Delete all devices
            await codexPool.query(
                'DELETE FROM user_devices WHERE user_id = $1',
                [userId]
            );
        }

        res.json({ success: true, message: 'Signed out from all devices' });

    } catch (err) {
        console.error('Sign out all error:', err);
        res.status(500).json({ success: false, error: 'Failed to sign out from devices' });
    }
});

// Delete account
app.delete('/api/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, error: 'Password required to delete account' });
        }

        // Verify password
        const userResult = await codexPool.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const isValid = await bcrypt.compare(password, userResult.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid password' });
        }

        // Soft delete - set is_active to false
        await codexPool.query(
            'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
            [userId]
        );

        // Delete all devices
        await codexPool.query('DELETE FROM user_devices WHERE user_id = $1', [userId]);

        res.json({ success: true, message: 'Account deleted' });

    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete account' });
    }
});

// =============================================================================
// CHAT API - OpenAI Integration for JubileeInspire.com
// =============================================================================

/**
 * Chat with Jubilee Inspire
 * POST /Home/ChatWithJubilee
 *
 * This endpoint handles chat messages using OpenAI API directly.
 * Operates independently from JubileeVerse.com.
 */
app.post('/Home/ChatWithJubilee', async (req, res) => {
    const {
        message,
        conversationHistory = [],
        personaName = 'Jubilee Inspire',
        conversationId = null,
        inspireModel = 'gospelpulse',
        responseLanguage = 'en',
        systemPrompt = '',
        developerPrompt = ''
    } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY not configured');
        return res.status(500).json({ success: false, error: 'Chat service not configured' });
    }

    try {
        // Build messages array for OpenAI
        const messages = [];

        // Add system prompt if provided (from model_system.txt)
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Add developer prompt if provided (from model_*.txt + model_developer.txt)
        if (developerPrompt) {
            messages.push({ role: 'developer', content: developerPrompt });
        }

        // RAG: Search Qdrant for relevant context
        let ragContext = null;
        let ragResultCount = 0;
        try {
            const ragResult = await qdrantService.searchKnowledge(message.trim(), {
                limit: 5,
                minScore: 0.45
            });
            if (ragResult.success && ragResult.context) {
                ragContext = ragResult.context;
                ragResultCount = ragResult.resultCount || 0;
                // Inject RAG context as a system message
                messages.push({
                    role: 'system',
                    content: ragContext
                });
                console.log(`RAG: Found ${ragResultCount} relevant knowledge chunks`);
            }
        } catch (ragError) {
            console.warn('RAG search failed (continuing without context):', ragError.message);
        }

        // Add conversation history
        conversationHistory.forEach(msg => {
            if (msg.role && msg.content) {
                messages.push({ role: msg.role, content: msg.content });
            }
        });

        // Add current user message
        messages.push({ role: 'user', content: message.trim() });

        console.log(`Chat request: model=${inspireModel}, historyLength=${conversationHistory.length}, messageLength=${message.length}, ragContext=${ragResultCount > 0}`);

        // Call OpenAI API
        const startTime = Date.now();
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 1024,
                temperature: 0.7
            })
        });

        const processingTime = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenAI API error:', response.status, errorData);
            return res.status(500).json({
                success: false,
                error: 'Failed to generate response',
                details: errorData.error?.message || 'Unknown error'
            });
        }

        const data = await response.json();
        const assistantResponse = data.choices?.[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

        // Generate conversation ID if not provided
        const finalConversationId = conversationId || `inspire-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        console.log(`Chat response: processingTime=${processingTime}ms, responseLength=${assistantResponse.length}, ragUsed=${ragResultCount > 0}`);

        res.json({
            success: true,
            response: assistantResponse,
            model: 'gpt-4o-mini',
            personaName,
            conversation: {
                id: finalConversationId,
                title: message.length > 50 ? message.substring(0, 47) + '...' : message,
                isNew: !conversationId,
                personaName,
                lastMessage: assistantResponse.substring(0, 100) + (assistantResponse.length > 100 ? '...' : ''),
                timestamp: new Date().toISOString()
            },
            usage: data.usage || null,
            processingTimeMs: processingTime,
            rag: {
                enabled: true,
                contextUsed: ragResultCount > 0,
                resultCount: ragResultCount
            }
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process chat request',
            details: error.message
        });
    }
});

// =============================================================================
// DEVELOPER TASKS API - Automated Task Tracking for Jubilee Tasks Extension
// =============================================================================

/**
 * Get all developer projects
 * GET /api/v1/developer/projects
 */
app.get('/api/v1/developer/projects', async (req, res) => {
    try {
        const { category, active = 'true' } = req.query;
        let query = 'SELECT * FROM developer_projects WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (category) {
            query += ` AND project_category = $${paramIndex++}`;
            params.push(category);
        }

        if (active === 'true') {
            query += ' AND is_active = true';
        }

        query += ' ORDER BY project_name ASC';

        const result = await codexPool.query(query, params);
        res.json({ success: true, projects: result.rows });
    } catch (err) {
        console.error('Get developer projects error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch projects', message: err.message });
    }
});

/**
 * Create or update a developer project
 * POST /api/v1/developer/projects
 */
app.post('/api/v1/developer/projects', async (req, res) => {
    try {
        const { project_name, project_category, project_type, folder_path, description } = req.body;

        if (!project_name || !project_category) {
            return res.status(400).json({ success: false, error: 'project_name and project_category are required' });
        }

        const result = await codexPool.query(`
            INSERT INTO developer_projects (project_name, project_category, project_type, folder_path, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (project_name) DO UPDATE SET
                project_category = EXCLUDED.project_category,
                project_type = EXCLUDED.project_type,
                folder_path = EXCLUDED.folder_path,
                description = EXCLUDED.description,
                updated_at = NOW()
            RETURNING *
        `, [project_name.toLowerCase(), project_category, project_type, folder_path, description]);

        res.status(201).json({ success: true, project: result.rows[0] });
    } catch (err) {
        console.error('Create developer project error:', err);
        res.status(500).json({ success: false, error: 'Failed to create project', message: err.message });
    }
});

/**
 * Get developer tasks with optional filters
 * GET /api/v1/developer/tasks
 */
app.get('/api/v1/developer/tasks', async (req, res) => {
    try {
        const {
            developer,
            project_name,
            status,
            date,
            start_date,
            end_date,
            session_id,
            limit = 100,
            offset = 0,
            sort_by = 'start_time',
            sort_order = 'DESC'
        } = req.query;

        let query = `
            SELECT t.*,
                   p.project_category,
                   p.project_type,
                   CASE
                       WHEN t.active_duration_ms > 0 THEN
                           LPAD((t.active_duration_ms / 3600000)::TEXT, 2, '0') || ':' ||
                           LPAD(((t.active_duration_ms % 3600000) / 60000)::TEXT, 2, '0') || ':' ||
                           LPAD(((t.active_duration_ms % 60000) / 1000)::TEXT, 2, '0')
                       ELSE '00:00:00'
                   END AS duration_formatted
            FROM developer_tasks t
            LEFT JOIN developer_projects p ON t.project_id = p.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (developer) {
            query += ` AND t.developer_initials = $${paramIndex++}`;
            params.push(developer.toUpperCase());
        }

        if (project_name) {
            query += ` AND t.project_name = $${paramIndex++}`;
            params.push(project_name.toLowerCase());
        }

        if (status) {
            query += ` AND t.status = $${paramIndex++}`;
            params.push(status);
        }

        if (date) {
            query += ` AND DATE(t.start_time AT TIME ZONE 'UTC') = $${paramIndex++}`;
            params.push(date);
        }

        if (start_date) {
            query += ` AND t.start_time >= $${paramIndex++}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND t.start_time <= $${paramIndex++}`;
            params.push(end_date);
        }

        if (session_id) {
            query += ` AND t.session_id = $${paramIndex++}`;
            params.push(session_id);
        }

        // Validate sort column to prevent SQL injection
        const validSortColumns = ['start_time', 'end_time', 'task_code', 'task_number', 'project_name', 'developer_initials', 'status'];
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'start_time';
        const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        query += ` ORDER BY t.${sortColumn} ${sortDir}`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await codexPool.query(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM developer_tasks t WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;

        if (developer) {
            countQuery += ` AND t.developer_initials = $${countParamIndex++}`;
            countParams.push(developer.toUpperCase());
        }
        if (project_name) {
            countQuery += ` AND t.project_name = $${countParamIndex++}`;
            countParams.push(project_name.toLowerCase());
        }
        if (status) {
            countQuery += ` AND t.status = $${countParamIndex++}`;
            countParams.push(status);
        }
        if (date) {
            countQuery += ` AND DATE(t.start_time AT TIME ZONE 'UTC') = $${countParamIndex++}`;
            countParams.push(date);
        }

        const countResult = await codexPool.query(countQuery, countParams);

        res.json({
            success: true,
            tasks: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error('Get developer tasks error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch tasks', message: err.message });
    }
});

/**
 * Get a single developer task by ID
 * GET /api/v1/developer/tasks/:id
 */
app.get('/api/v1/developer/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await codexPool.query(`
            SELECT t.*,
                   p.project_category,
                   p.project_type,
                   CASE
                       WHEN t.active_duration_ms > 0 THEN
                           LPAD((t.active_duration_ms / 3600000)::TEXT, 2, '0') || ':' ||
                           LPAD(((t.active_duration_ms % 3600000) / 60000)::TEXT, 2, '0') || ':' ||
                           LPAD(((t.active_duration_ms % 60000) / 1000)::TEXT, 2, '0')
                       ELSE '00:00:00'
                   END AS duration_formatted
            FROM developer_tasks t
            LEFT JOIN developer_projects p ON t.project_id = p.id
            WHERE t.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('Get developer task error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch task', message: err.message });
    }
});

/**
 * Get next available task code
 * GET /api/v1/developer/tasks/next-code
 */
app.get('/api/v1/developer/tasks/next-code', async (req, res) => {
    try {
        const result = await codexPool.query('SELECT generate_task_code() as task_code');
        res.json({ success: true, task_code: result.rows[0].task_code });
    } catch (err) {
        console.error('Get next task code error:', err);
        res.status(500).json({ success: false, error: 'Failed to generate task code', message: err.message });
    }
});

/**
 * Create a new developer task
 * POST /api/v1/developer/tasks
 */
app.post('/api/v1/developer/tasks', async (req, res) => {
    try {
        const {
            project_name,
            developer_initials,
            task_name,
            original_prompt,
            session_id,
            machine_name,
            workspace_path
        } = req.body;

        if (!project_name || !developer_initials || !task_name) {
            return res.status(400).json({
                success: false,
                error: 'project_name, developer_initials, and task_name are required'
            });
        }

        // Validate developer initials (exactly 2 letters)
        if (!/^[A-Za-z]{2}$/.test(developer_initials)) {
            return res.status(400).json({
                success: false,
                error: 'developer_initials must be exactly 2 letters'
            });
        }

        // Get or create project
        let projectResult = await codexPool.query(
            'SELECT id FROM developer_projects WHERE project_name = $1',
            [project_name.toLowerCase()]
        );

        let projectId = null;
        if (projectResult.rows.length > 0) {
            projectId = projectResult.rows[0].id;
        }

        // Generate task code
        const codeResult = await codexPool.query('SELECT generate_task_code() as task_code');
        const taskCode = codeResult.rows[0].task_code;

        // Create task
        const result = await codexPool.query(`
            INSERT INTO developer_tasks (
                task_code,
                project_id,
                project_name,
                developer_initials,
                task_name,
                original_prompt,
                status,
                session_id,
                machine_name,
                workspace_path,
                last_activity_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', $7, $8, $9, NOW())
            RETURNING *
        `, [
            taskCode,
            projectId,
            project_name.toLowerCase(),
            developer_initials.toUpperCase(),
            task_name,
            original_prompt,
            session_id,
            machine_name,
            workspace_path
        ]);

        console.log(`Created developer task: ${taskCode} - ${task_name}`);

        res.status(201).json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('Create developer task error:', err);
        res.status(500).json({ success: false, error: 'Failed to create task', message: err.message });
    }
});

/**
 * Update a developer task
 * PUT /api/v1/developer/tasks/:id
 */
app.put('/api/v1/developer/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            task_name,
            status,
            end_time,
            active_duration_ms
        } = req.body;

        // Build dynamic update query
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (task_name !== undefined) {
            updates.push(`task_name = $${paramIndex++}`);
            params.push(task_name);
        }

        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        if (end_time !== undefined) {
            updates.push(`end_time = $${paramIndex++}`);
            params.push(end_time);
        }

        if (active_duration_ms !== undefined) {
            updates.push(`active_duration_ms = $${paramIndex++}`);
            params.push(active_duration_ms);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        params.push(id);
        const query = `
            UPDATE developer_tasks
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await codexPool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('Update developer task error:', err);
        res.status(500).json({ success: false, error: 'Failed to update task', message: err.message });
    }
});

/**
 * Update task activity timestamp (for inactivity tracking)
 * PUT /api/v1/developer/tasks/:id/activity
 */
app.put('/api/v1/developer/tasks/:id/activity', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await codexPool.query(`
            UPDATE developer_tasks
            SET last_activity_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING id, last_activity_at
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('Update task activity error:', err);
        res.status(500).json({ success: false, error: 'Failed to update activity', message: err.message });
    }
});

/**
 * Complete a developer task
 * POST /api/v1/developer/tasks/:id/complete
 */
app.post('/api/v1/developer/tasks/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        const { active_duration_ms, ehh_minutes } = req.body;

        const result = await codexPool.query(`
            UPDATE developer_tasks
            SET status = 'complete',
                end_time = NOW(),
                active_duration_ms = $2,
                ehh_minutes = $3,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id, active_duration_ms || 0, ehh_minutes || null]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        console.log(`Completed developer task: ${result.rows[0].task_code}`);

        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('Complete developer task error:', err);
        res.status(500).json({ success: false, error: 'Failed to complete task', message: err.message });
    }
});

/**
 * Update a developer task's EHH value
 * PUT /api/v1/developer/tasks/:id/ehh
 */
app.put('/api/v1/developer/tasks/:id/ehh', async (req, res) => {
    try {
        const { id } = req.params;
        const { ehh_minutes } = req.body;

        if (ehh_minutes === undefined || ehh_minutes === null) {
            return res.status(400).json({ success: false, error: 'ehh_minutes is required' });
        }

        const result = await codexPool.query(`
            UPDATE developer_tasks
            SET ehh_minutes = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id, ehh_minutes]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        console.log(`Updated EHH for task ${result.rows[0].task_code}: ${ehh_minutes} minutes`);

        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('Update developer task EHH error:', err);
        res.status(500).json({ success: false, error: 'Failed to update EHH', message: err.message });
    }
});

/**
 * Get developer task statistics
 * GET /api/v1/developer/tasks/stats
 */
app.get('/api/v1/developer/tasks/stats', async (req, res) => {
    try {
        const { developer, start_date, end_date } = req.query;

        let query = `
            SELECT
                developer_initials,
                DATE(start_time AT TIME ZONE 'UTC') as task_date,
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE status = 'complete') as completed_tasks,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
                SUM(active_duration_ms) as total_duration_ms
            FROM developer_tasks
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (developer) {
            query += ` AND developer_initials = $${paramIndex++}`;
            params.push(developer.toUpperCase());
        }

        if (start_date) {
            query += ` AND start_time >= $${paramIndex++}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND start_time <= $${paramIndex++}`;
            params.push(end_date);
        }

        query += ` GROUP BY developer_initials, DATE(start_time AT TIME ZONE 'UTC')`;
        query += ` ORDER BY task_date DESC, developer_initials`;

        const result = await codexPool.query(query, params);

        res.json({ success: true, stats: result.rows });
    } catch (err) {
        console.error('Get developer task stats error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch stats', message: err.message });
    }
});

/**
 * Get in-progress tasks for a session
 * GET /api/v1/developer/tasks/session/:sessionId/active
 */
app.get('/api/v1/developer/tasks/session/:sessionId/active', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await codexPool.query(`
            SELECT * FROM developer_tasks
            WHERE session_id = $1 AND status = 'in_progress'
            ORDER BY start_time DESC
            LIMIT 1
        `, [sessionId]);

        res.json({
            success: true,
            task: result.rows.length > 0 ? result.rows[0] : null
        });
    } catch (err) {
        console.error('Get active task error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch active task', message: err.message });
    }
});

// =============================================================================
// USER TODOS API ROUTES
// =============================================================================

// Get all todos for a user
app.get('/api/todos', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email parameter required' });
        }

        const result = await codexPool.query(
            `SELECT id, title, description, is_completed as "isCompleted", priority,
                    status, assigned_to as "assignedTo",
                    due_date as "dueDate", created_at as "createdAt", updated_at as "updatedAt",
                    user_email as "userEmail"
             FROM user_todos
             WHERE user_email = $1
             ORDER BY is_completed ASC, created_at ASC`,
            [email.toLowerCase()]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Get todos error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch todos' });
    }
});

// Create a new todo
app.post('/api/todos', async (req, res) => {
    try {
        const { email, title, description, priority, status, assignedTo, dueDate } = req.body;

        if (!email || !title) {
            return res.status(400).json({ success: false, error: 'Email and title are required' });
        }

        const result = await codexPool.query(
            `INSERT INTO user_todos (user_email, title, description, priority, status, assigned_to, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, title, description, is_completed as "isCompleted", priority,
                       status, assigned_to as "assignedTo",
                       due_date as "dueDate", created_at as "createdAt", updated_at as "updatedAt",
                       user_email as "userEmail"`,
            [email.toLowerCase(), title, description || null, priority || 'Medium', status || 'Pending', assignedTo || null, dueDate || null]
        );

        res.status(201).json({ success: true, todo: result.rows[0] });
    } catch (err) {
        console.error('Create todo error:', err);
        res.status(500).json({ success: false, error: 'Failed to create todo' });
    }
});

// Update a todo
app.put('/api/todos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, isCompleted, priority, status, assignedTo, dueDate } = req.body;

        const result = await codexPool.query(
            `UPDATE user_todos
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 is_completed = COALESCE($3, is_completed),
                 priority = COALESCE($4, priority),
                 status = COALESCE($5, status),
                 assigned_to = COALESCE($6, assigned_to),
                 due_date = COALESCE($7, due_date),
                 updated_at = NOW()
             WHERE id = $8
             RETURNING id, title, description, is_completed as "isCompleted", priority,
                       status, assigned_to as "assignedTo",
                       due_date as "dueDate", created_at as "createdAt", updated_at as "updatedAt",
                       user_email as "userEmail"`,
            [title, description, isCompleted, priority, status, assignedTo, dueDate, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Todo not found' });
        }

        res.json({ success: true, todo: result.rows[0] });
    } catch (err) {
        console.error('Update todo error:', err);
        res.status(500).json({ success: false, error: 'Failed to update todo' });
    }
});

// Delete a todo
app.delete('/api/todos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await codexPool.query(
            'DELETE FROM user_todos WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Todo not found' });
        }

        res.json({ success: true, message: 'Todo deleted' });
    } catch (err) {
        console.error('Delete todo error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete todo' });
    }
});

// =============================================================================
// DAILY NEWS CACHE API (JubileeDailyNews Service)
// =============================================================================

// Cache a transformed news story
app.post('/api/v1/daily-news/cache', async (req, res) => {
    try {
        const {
            originalTitle,
            originalUrl,
            originalExcerpt,
            rewrittenTitle,
            rewrittenContent,
            source,
            sourceName,
            storyCluster,
            prominenceScore,
            rank,
            imageData,
            imageMimeType,
            imageOriginalSize,
            imageFinalSize,
            imageWasResized,
            fetchedAt
        } = req.body;

        // Validate required fields
        if (!originalTitle || !rewrittenTitle || !source) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: originalTitle, rewrittenTitle, source'
            });
        }

        // Check for duplicate (same URL within last 24 hours)
        const existingResult = await inspirePool.query(`
            SELECT id FROM daily_news_cache
            WHERE original_url = $1
            AND fetched_at > NOW() - INTERVAL '24 hours'
        `, [originalUrl]);

        if (existingResult.rows.length > 0) {
            return res.status(200).json({
                success: true,
                id: existingResult.rows[0].id,
                message: 'Story already cached within 24 hours',
                duplicate: true
            });
        }

        // Insert the new story
        const result = await inspirePool.query(`
            INSERT INTO daily_news_cache (
                original_title,
                original_url,
                original_excerpt,
                rewritten_title,
                rewritten_content,
                source,
                source_name,
                story_cluster,
                prominence_score,
                rank,
                image_data,
                image_mime_type,
                image_original_size,
                image_final_size,
                image_was_resized,
                fetched_at,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
            RETURNING id, created_at
        `, [
            originalTitle,
            originalUrl,
            originalExcerpt,
            rewrittenTitle,
            rewrittenContent,
            source,
            sourceName,
            storyCluster,
            prominenceScore,
            rank,
            imageData,
            imageMimeType,
            imageOriginalSize,
            imageFinalSize,
            imageWasResized,
            fetchedAt || new Date().toISOString()
        ]);

        console.log(`[DailyNews] Cached story: "${rewrittenTitle.substring(0, 50)}..." from ${sourceName}`);

        res.status(201).json({
            success: true,
            id: result.rows[0].id,
            createdAt: result.rows[0].created_at,
            message: 'Story cached successfully'
        });

    } catch (err) {
        console.error('[DailyNews] Cache error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to cache story',
            details: NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Get cached news stories
app.get('/api/v1/daily-news', async (req, res) => {
    try {
        const { limit = 10, hours = 24, source, cluster } = req.query;

        let query = `
            SELECT
                id,
                original_title,
                original_url,
                original_excerpt,
                rewritten_title,
                rewritten_content,
                source,
                source_name,
                story_cluster,
                prominence_score,
                rank,
                image_mime_type,
                image_original_size,
                image_final_size,
                image_was_resized,
                fetched_at,
                created_at
            FROM daily_news_cache
            WHERE fetched_at > NOW() - INTERVAL '${parseInt(hours)} hours'
        `;

        const params = [];
        let paramIndex = 1;

        if (source) {
            query += ` AND source = $${paramIndex}`;
            params.push(source);
            paramIndex++;
        }

        if (cluster) {
            query += ` AND story_cluster = $${paramIndex}`;
            params.push(cluster);
            paramIndex++;
        }

        query += ` ORDER BY prominence_score DESC, fetched_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));

        const result = await inspirePool.query(query, params);

        res.json({
            success: true,
            count: result.rows.length,
            stories: result.rows.map(row => ({
                id: row.id,
                originalTitle: row.original_title,
                originalUrl: row.original_url,
                originalExcerpt: row.original_excerpt,
                rewrittenTitle: row.rewritten_title,
                rewrittenContent: row.rewritten_content,
                source: row.source,
                sourceName: row.source_name,
                storyCluster: row.story_cluster,
                prominenceScore: row.prominence_score,
                rank: row.rank,
                hasImage: !!row.image_mime_type,
                imageWasResized: row.image_was_resized,
                fetchedAt: row.fetched_at,
                createdAt: row.created_at
            }))
        });

    } catch (err) {
        console.error('[DailyNews] Fetch error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cached stories'
        });
    }
});

// Get a single cached story with image data
app.get('/api/v1/daily-news/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { includeImage = 'false' } = req.query;

        let columns = `
            id,
            original_title,
            original_url,
            original_excerpt,
            rewritten_title,
            rewritten_content,
            source,
            source_name,
            story_cluster,
            prominence_score,
            rank,
            image_mime_type,
            image_original_size,
            image_final_size,
            image_was_resized,
            fetched_at,
            created_at
        `;

        if (includeImage === 'true') {
            columns += ', image_data';
        }

        const result = await inspirePool.query(`
            SELECT ${columns} FROM daily_news_cache WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }

        const row = result.rows[0];

        res.json({
            success: true,
            story: {
                id: row.id,
                originalTitle: row.original_title,
                originalUrl: row.original_url,
                originalExcerpt: row.original_excerpt,
                rewrittenTitle: row.rewritten_title,
                rewrittenContent: row.rewritten_content,
                source: row.source,
                sourceName: row.source_name,
                storyCluster: row.story_cluster,
                prominenceScore: row.prominence_score,
                rank: row.rank,
                imageMimeType: row.image_mime_type,
                imageData: row.image_data || null,
                imageOriginalSize: row.image_original_size,
                imageFinalSize: row.image_final_size,
                imageWasResized: row.image_was_resized,
                fetchedAt: row.fetched_at,
                createdAt: row.created_at
            }
        });

    } catch (err) {
        console.error('[DailyNews] Fetch single error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch story'
        });
    }
});

// Get cached story image
app.get('/api/v1/daily-news/:id/image', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await inspirePool.query(`
            SELECT image_data, image_mime_type
            FROM daily_news_cache
            WHERE id = $1 AND image_data IS NOT NULL
        `, [id]);

        if (result.rows.length === 0 || !result.rows[0].image_data) {
            return res.status(404).json({
                success: false,
                error: 'Image not found'
            });
        }

        const { image_data, image_mime_type } = result.rows[0];
        const imageBuffer = Buffer.from(image_data, 'base64');

        res.set('Content-Type', image_mime_type || 'image/jpeg');
        res.set('Content-Length', imageBuffer.length);
        res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        res.send(imageBuffer);

    } catch (err) {
        console.error('[DailyNews] Image fetch error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch image'
        });
    }
});

// Get daily news statistics
app.get('/api/v1/daily-news/stats', async (req, res) => {
    try {
        const statsResult = await inspirePool.query(`
            SELECT
                COUNT(*) as total_stories,
                COUNT(DISTINCT source) as unique_sources,
                COUNT(DISTINCT story_cluster) as unique_clusters,
                AVG(prominence_score)::integer as avg_prominence,
                COUNT(CASE WHEN image_data IS NOT NULL THEN 1 END) as stories_with_images,
                COUNT(CASE WHEN image_was_resized THEN 1 END) as images_resized,
                MIN(fetched_at) as oldest_story,
                MAX(fetched_at) as newest_story
            FROM daily_news_cache
            WHERE fetched_at > NOW() - INTERVAL '24 hours'
        `);

        const clusterStats = await inspirePool.query(`
            SELECT story_cluster, COUNT(*) as count
            FROM daily_news_cache
            WHERE fetched_at > NOW() - INTERVAL '24 hours'
            GROUP BY story_cluster
            ORDER BY count DESC
        `);

        const sourceStats = await inspirePool.query(`
            SELECT source_name, COUNT(*) as count, AVG(prominence_score)::integer as avg_score
            FROM daily_news_cache
            WHERE fetched_at > NOW() - INTERVAL '24 hours'
            GROUP BY source_name
            ORDER BY count DESC
        `);

        res.json({
            success: true,
            stats: {
                ...statsResult.rows[0],
                clusterBreakdown: clusterStats.rows,
                sourceBreakdown: sourceStats.rows
            }
        });

    } catch (err) {
        console.error('[DailyNews] Stats error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// Delete old cached stories (cleanup endpoint)
app.delete('/api/v1/daily-news/cleanup', async (req, res) => {
    try {
        const { hours = 48 } = req.query;

        const result = await inspirePool.query(`
            DELETE FROM daily_news_cache
            WHERE fetched_at < NOW() - INTERVAL '${parseInt(hours)} hours'
            RETURNING id
        `);

        console.log(`[DailyNews] Cleanup: removed ${result.rowCount} old stories`);

        res.json({
            success: true,
            deletedCount: result.rowCount,
            message: `Removed stories older than ${hours} hours`
        });

    } catch (err) {
        console.error('[DailyNews] Cleanup error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup old stories'
        });
    }
});

// =============================================================================
// SERVICE MANAGEMENT API - Inspire 8.0 Services Configuration
// =============================================================================

const SERVICES_DIR = path.join(__dirname, '..', '..', '..', 'services', 'Inspire.8.0');

// Get all service configurations
app.get('/api/v1/services', async (req, res) => {
    try {
        const configs = {};

        // Read website services config
        const websitesPath = path.join(SERVICES_DIR, 'websites-services.json');
        if (fs.existsSync(websitesPath)) {
            configs.websites = JSON.parse(fs.readFileSync(websitesPath, 'utf8'));
        }

        // Read API services config
        const apiPath = path.join(SERVICES_DIR, 'api-services.json');
        if (fs.existsSync(apiPath)) {
            configs.api = JSON.parse(fs.readFileSync(apiPath, 'utf8'));
        }

        // Read Docker services config
        const dockerPath = path.join(SERVICES_DIR, 'docker-services.json');
        if (fs.existsSync(dockerPath)) {
            configs.docker = JSON.parse(fs.readFileSync(dockerPath, 'utf8'));
        }

        res.json({
            success: true,
            configs,
            servicesDirectory: SERVICES_DIR
        });
    } catch (err) {
        console.error('[Services] Error loading configs:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to load service configurations',
            message: err.message
        });
    }
});

// =============================================================================
// URL PROBE API - Test any URL and return status (used by frontend health checks)
// Must be defined BEFORE the :type route to avoid being caught by it
// =============================================================================
app.get('/api/v1/services/probe', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ ok: false, error: 'URL parameter required' });
    }

    // Validate URL format
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (e) {
        return res.status(400).json({ ok: false, error: 'Invalid URL format' });
    }

    // Only allow HTTPS URLs for security
    if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ ok: false, error: 'Only HTTPS URLs allowed' });
    }

    const startTime = Date.now();

    try {
        const https = require('https');
        const result = await new Promise((resolve) => {
            const req = https.get(url, {
                timeout: 5000,
                rejectUnauthorized: false, // Accept self-signed certs
                headers: {
                    'User-Agent': 'JubileeHealthCheck/1.0'
                }
            }, (response) => {
                const ok = response.statusCode >= 200 && response.statusCode < 400;
                resolve({
                    ok,
                    status: response.statusCode,
                    responseTime: Date.now() - startTime,
                    error: ok ? null : `HTTP ${response.statusCode}`
                });
            });

            req.on('error', (err) => {
                resolve({
                    ok: false,
                    status: 0,
                    responseTime: Date.now() - startTime,
                    error: err.code || err.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    ok: false,
                    status: 0,
                    responseTime: Date.now() - startTime,
                    error: 'TIMEOUT'
                });
            });
        });

        res.json(result);
    } catch (err) {
        res.json({
            ok: false,
            status: 0,
            responseTime: Date.now() - startTime,
            error: err.message
        });
    }
});

// Get specific service configuration (websites, api, docker)
app.get('/api/v1/services/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const configMap = {
            'websites': 'websites-services.json',
            'api': 'api-services.json',
            'docker': 'docker-services.json'
        };

        if (!configMap[type]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service type',
                validTypes: Object.keys(configMap)
            });
        }

        const configPath = path.join(SERVICES_DIR, configMap[type]);
        if (!fs.existsSync(configPath)) {
            return res.status(404).json({
                success: false,
                error: 'Configuration file not found',
                path: configPath
            });
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        res.json({
            success: true,
            type,
            config
        });
    } catch (err) {
        console.error('[Services] Error loading config:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to load configuration',
            message: err.message
        });
    }
});

// Update a single service within a configuration
app.put('/api/v1/services/:type/:serviceName', async (req, res) => {
    try {
        const { type, serviceName } = req.params;
        const updates = req.body;

        const configMap = {
            'websites': 'websites-services.json',
            'api': 'api-services.json',
            'docker': 'docker-services.json'
        };

        if (!configMap[type]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service type',
                validTypes: Object.keys(configMap)
            });
        }

        const configPath = path.join(SERVICES_DIR, configMap[type]);
        if (!fs.existsSync(configPath)) {
            return res.status(404).json({
                success: false,
                error: 'Configuration file not found'
            });
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Find and update the service
        const serviceKey = type === 'docker' ? 'containers' : 'services';
        const serviceIndex = config[serviceKey].findIndex(s => s.name === serviceName);

        if (serviceIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Service not found',
                serviceName
            });
        }

        // Merge updates with existing service config
        const existingService = config[serviceKey][serviceIndex];
        config[serviceKey][serviceIndex] = {
            ...existingService,
            ...updates
        };

        // Write updated config back to file
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        console.log(`[Services] Updated ${serviceName} in ${type} config`);

        res.json({
            success: true,
            message: `Service ${serviceName} updated successfully`,
            service: config[serviceKey][serviceIndex],
            requiresReload: true
        });
    } catch (err) {
        console.error('[Services] Error updating service:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to update service',
            message: err.message
        });
    }
});

// Bulk update services configuration
app.put('/api/v1/services/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const updates = req.body;

        const configMap = {
            'websites': 'websites-services.json',
            'api': 'api-services.json',
            'docker': 'docker-services.json'
        };

        if (!configMap[type]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service type',
                validTypes: Object.keys(configMap)
            });
        }

        const configPath = path.join(SERVICES_DIR, configMap[type]);
        if (!fs.existsSync(configPath)) {
            return res.status(404).json({
                success: false,
                error: 'Configuration file not found'
            });
        }

        // Backup existing config
        const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const backupPath = configPath.replace('.json', `.backup-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(existingConfig, null, 2));

        // Write new config
        const newConfig = {
            ...existingConfig,
            ...updates
        };
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

        console.log(`[Services] Updated ${type} config, backup created at ${backupPath}`);

        res.json({
            success: true,
            message: `${type} configuration updated successfully`,
            backupPath,
            requiresReload: true
        });
    } catch (err) {
        console.error('[Services] Error updating config:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to update configuration',
            message: err.message
        });
    }
});

// Trigger service reload (touches .reload-trigger file)
app.post('/api/v1/services/:type/reload', async (req, res) => {
    try {
        const { type } = req.params;
        const reloadTrigger = path.join(SERVICES_DIR, '.reload-trigger');

        // Touch the reload trigger file
        const now = new Date();
        fs.utimesSync(reloadTrigger, now, now);

        console.log(`[Services] Reload triggered for ${type} services`);

        res.json({
            success: true,
            message: `Reload triggered for ${type} services`,
            timestamp: now.toISOString()
        });
    } catch (err) {
        // File might not exist, create it
        try {
            const reloadTrigger = path.join(SERVICES_DIR, '.reload-trigger');
            fs.writeFileSync(reloadTrigger, new Date().toISOString());
            res.json({
                success: true,
                message: 'Reload trigger created',
                timestamp: new Date().toISOString()
            });
        } catch (createErr) {
            console.error('[Services] Error triggering reload:', createErr);
            res.status(500).json({
                success: false,
                error: 'Failed to trigger reload',
                message: createErr.message
            });
        }
    }
});

// Get service health from service manager health endpoints
app.get('/api/v1/services/health/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const healthPorts = {
            'websites': 3900,
            'api': 3901,
            'docker': 3902
        };

        if (!healthPorts[type]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service type',
                validTypes: Object.keys(healthPorts)
            });
        }

        const port = healthPorts[type];
        const healthUrl = `http://localhost:${port}/health`;

        const healthResponse = await new Promise((resolve) => {
            const req = http.get(healthUrl, { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: 'ok', data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: 'error', error: 'Invalid JSON response' });
                    }
                });
            });
            req.on('error', (err) => resolve({ status: 'offline', error: err.message }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ status: 'timeout', error: 'Request timed out' });
            });
        });

        res.json({
            success: healthResponse.status === 'ok',
            type,
            port,
            ...healthResponse
        });
    } catch (err) {
        console.error('[Services] Error fetching health:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch service health',
            message: err.message
        });
    }
});

// Check individual service HTTP health by making actual HTTP requests
// Tests PUBLIC URLs (https://domain.com) to reflect what users actually experience
app.get('/api/v1/services/check/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const configPath = path.join(SERVICES_DIR, `${type}-services.json`);

        if (!fs.existsSync(configPath)) {
            return res.status(404).json({
                success: false,
                error: `Configuration file not found for type: ${type}`
            });
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const services = config.services || [];

        // Helper to extract domain from cwd path
        const getDomainFromCwd = (cwd) => {
            if (!cwd) return null;
            const parts = cwd.replace(/\\/g, '/').split('/');
            const domain = parts[parts.length - 1];
            if (domain && domain.includes('.')) return domain;
            return null;
        };

        // Helper to check a URL with HTTPS support
        const checkUrl = (url, timeout = 5000) => {
            return new Promise((resolve) => {
                const startTime = Date.now();
                const protocol = url.startsWith('https') ? require('https') : http;

                const reqOptions = {
                    timeout,
                    rejectUnauthorized: false, // Accept self-signed certs
                    headers: {
                        'User-Agent': 'JubileeHealthCheck/1.0'
                    }
                };

                const req = protocol.get(url, reqOptions, (response) => {
                    // Follow redirects (301, 302, 307, 308)
                    if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
                        // Don't follow redirects, just report the status
                        resolve({
                            status: response.statusCode,
                            ok: true, // Redirects are considered OK
                            responseTime: Date.now() - startTime,
                            redirect: response.headers.location
                        });
                        return;
                    }

                    resolve({
                        status: response.statusCode,
                        ok: response.statusCode >= 200 && response.statusCode < 400,
                        responseTime: Date.now() - startTime
                    });
                });

                req.on('error', (err) => {
                    resolve({
                        status: 0,
                        ok: false,
                        error: err.code || err.message,
                        responseTime: Date.now() - startTime
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        status: 0,
                        ok: false,
                        error: 'TIMEOUT',
                        responseTime: Date.now() - startTime
                    });
                });
            });
        };

        // Check each service with HTTP request
        const checkPromises = services.map(async (service) => {
            const { name, port, enabled, cwd } = service;

            // If disabled in config, report as disabled
            if (enabled === false) {
                return {
                    name,
                    port,
                    configStatus: 'disabled',
                    httpStatus: null,
                    httpOk: null,
                    responseTime: null,
                    error: null,
                    publicUrl: null,
                    internalOk: null
                };
            }

            // Get the public domain from cwd - PRODUCTION ONLY
            const domain = getDomainFromCwd(cwd);

            if (!domain) {
                // No valid domain found - cannot check
                return {
                    name,
                    port,
                    configStatus: 'enabled',
                    httpStatus: 0,
                    httpOk: false,
                    responseTime: 0,
                    error: 'NO_DOMAIN_CONFIGURED',
                    publicUrl: null
                };
            }

            const publicUrl = `https://${domain}/`;

            // Check ONLY the production public URL - that's what users access
            const publicCheck = await checkUrl(publicUrl, 5000);

            return {
                name,
                port,
                configStatus: 'enabled',
                httpStatus: publicCheck.status,
                httpOk: publicCheck.ok,
                responseTime: publicCheck.responseTime,
                error: publicCheck.error || null,
                publicUrl
            };
        });

        const results = await Promise.all(checkPromises);

        // Summary statistics
        const online = results.filter(r => r.httpOk === true).length;
        const offline = results.filter(r => r.configStatus === 'enabled' && r.httpOk === false).length;
        const disabled = results.filter(r => r.configStatus === 'disabled').length;

        // Log services that are offline for debugging
        const offline_services = results.filter(r =>
            r.configStatus === 'enabled' &&
            r.httpOk === false
        );
        if (offline_services.length > 0) {
            console.log(`[Health] ${offline_services.length} services are OFFLINE:`);
            offline_services.forEach(r => {
                console.log(`  - ${r.name} (${r.publicUrl}): ${r.error || `HTTP ${r.httpStatus}`}`);
            });
        }

        res.json({
            success: true,
            type,
            timestamp: new Date().toISOString(),
            summary: {
                total: results.length,
                online,
                offline,
                disabled
            },
            services: results
        });
    } catch (err) {
        console.error('[Services] Error checking services:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to check services',
            message: err.message
        });
    }
});

// =============================================================================
// INFRASTRUCTURE STATUS API - WSL2, Docker, Cloudflared Status
// =============================================================================

const { exec, execSync } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Helper to clean UTF-16LE encoded output from WSL
function cleanWslOutput(str) {
    if (!str) return '';
    // Remove null characters and extra spaces from UTF-16LE
    return str
        .replace(/\0/g, '')
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.replace(/(.)\s/g, '$1').trim())
        .filter(l => l)
        .join('\n');
}

// Helper to run WSL commands properly (uses bash -c to handle special characters)
async function runWslCommand(command, timeout = 10000) {
    return new Promise((resolve, reject) => {
        // Escape double quotes in command and wrap in bash -c
        const escapedCmd = command.replace(/"/g, '\\"');
        exec(`wsl -d Ubuntu-24.04 -- bash -c "${escapedCmd}"`, { timeout, encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error && !stdout) {
                reject(error);
            } else {
                resolve(stdout || '');
            }
        });
    });
}

// Helper to check if a port is listening
async function checkPort(port, host = 'localhost') {
    return new Promise((resolve) => {
        const net = require('net');
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            resolve(false);
        });
        socket.connect(port, host);
    });
}

// Get WSL2 and infrastructure status
app.get('/api/v1/infrastructure/status', async (req, res) => {
    try {
        const status = {
            wsl2: { status: 'unknown', distro: null, version: null },
            docker: { status: 'unknown', containers: [] },
            cloudflared: { status: 'unknown', tunnels: [] },
            databases: { status: 'unknown', services: [] },
            timestamp: new Date().toISOString()
        };

        // Check WSL2 by looking for vmmem process (WSL2 VM)
        try {
            const { stdout: taskList } = await execPromise('tasklist /FI "IMAGENAME eq vmmem" /FO CSV /NH', { timeout: 5000 });
            if (taskList.includes('vmmem')) {
                status.wsl2.status = 'running';
                status.wsl2.distro = 'Ubuntu-24.04';
                status.wsl2.version = '2';
            } else {
                // Also check for wslhost.exe
                const { stdout: wslHost } = await execPromise('tasklist /FI "IMAGENAME eq wslhost.exe" /FO CSV /NH', { timeout: 5000 });
                if (wslHost.includes('wslhost.exe')) {
                    status.wsl2.status = 'running';
                    status.wsl2.distro = 'Ubuntu-24.04';
                    status.wsl2.version = '2';
                } else {
                    status.wsl2.status = 'stopped';
                }
            }
        } catch (e) {
            status.wsl2.status = 'error';
            status.wsl2.error = 'Cannot check WSL status';
        }

        // Check Docker by probing known container ports
        try {
            const dockerPorts = [
                { port: 5432, name: 'postgres-codex', service: 'PostgreSQL Codex' },
                { port: 5433, name: 'postgres-inspire', service: 'PostgreSQL Inspire' },
                { port: 5434, name: 'postgres-continuum', service: 'PostgreSQL Continuum' },
                { port: 6333, name: 'qdrant', service: 'Qdrant Vector DB' },
                { port: 6379, name: 'redis', service: 'Redis Cache' },
                { port: 5050, name: 'pgadmin', service: 'pgAdmin' }
            ];

            const portChecks = await Promise.all(
                dockerPorts.map(async (p) => ({
                    ...p,
                    running: await checkPort(p.port)
                }))
            );

            const runningContainers = portChecks.filter(p => p.running);
            status.docker.status = runningContainers.length > 0 ? 'running' : 'stopped';
            status.docker.containers = portChecks.map(p => ({
                name: p.name,
                service: p.service,
                port: p.port,
                status: p.running ? 'Up' : 'Down'
            }));
            status.docker.count = runningContainers.length;
            status.docker.totalExpected = dockerPorts.length;
        } catch (e) {
            status.docker.status = 'error';
            status.docker.error = 'Cannot check Docker containers';
        }

        // Check cloudflared tunnel
        try {
            const { stdout: cfStatus } = await execPromise('tasklist /FI "IMAGENAME eq cloudflared.exe" /FO CSV /NH', { timeout: 5000 });
            if (cfStatus.includes('cloudflared.exe')) {
                status.cloudflared.status = 'running';
                const instances = cfStatus.split('\n').filter(l => l.includes('cloudflared.exe')).length;
                status.cloudflared.instances = instances;
            } else {
                status.cloudflared.status = 'stopped';
            }
        } catch (e) {
            status.cloudflared.status = 'error';
            status.cloudflared.error = e.message;
        }

        // Check database connectivity
        try {
            const dbServices = [];

            // Check Codex DB
            try {
                const codexResult = await codexPool.query('SELECT 1');
                dbServices.push({ name: 'Codex DB', status: 'connected', port: 5432 });
            } catch (e) {
                dbServices.push({ name: 'Codex DB', status: 'disconnected', error: e.message, port: 5432 });
            }

            // Check Inspire DB
            try {
                const inspireResult = await inspirePool.query('SELECT 1');
                dbServices.push({ name: 'Inspire DB', status: 'connected', port: 5433 });
            } catch (e) {
                dbServices.push({ name: 'Inspire DB', status: 'disconnected', error: e.message, port: 5433 });
            }

            // Check Qdrant
            try {
                const qdrantOk = await checkPort(6333);
                dbServices.push({ name: 'Qdrant', status: qdrantOk ? 'connected' : 'disconnected', port: 6333 });
            } catch (e) {
                dbServices.push({ name: 'Qdrant', status: 'disconnected', error: e.message, port: 6333 });
            }

            // Check Redis
            try {
                const redisOk = await checkPort(6379);
                dbServices.push({ name: 'Redis', status: redisOk ? 'connected' : 'disconnected', port: 6379 });
            } catch (e) {
                dbServices.push({ name: 'Redis', status: 'disconnected', error: e.message, port: 6379 });
            }

            const connectedCount = dbServices.filter(d => d.status === 'connected').length;
            status.databases.status = connectedCount === dbServices.length ? 'healthy' : (connectedCount > 0 ? 'degraded' : 'down');
            status.databases.services = dbServices;
            status.databases.connectedCount = connectedCount;
            status.databases.totalCount = dbServices.length;
        } catch (e) {
            status.databases.status = 'error';
            status.databases.error = 'Cannot check database connectivity';
        }

        res.json({ success: true, infrastructure: status });
    } catch (err) {
        console.error('[Infrastructure] Error getting status:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to get infrastructure status',
            message: err.message
        });
    }
});

// Get detailed Docker container info
app.get('/api/v1/infrastructure/docker', async (req, res) => {
    try {
        const stdout = await runWslCommand("docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.State}}'", 15000);
        const containers = stdout.split('\n').filter(l => l.trim()).map(line => {
            const [name, image, status, ports, state] = line.split('|');
            return { name, image, status, ports, state };
        }).filter(c => c.name);

        res.json({ success: true, containers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get cloudflared tunnel status
app.get('/api/v1/infrastructure/cloudflared', async (req, res) => {
    try {
        // Check if cloudflared is running
        const { stdout: taskList } = await execPromise('tasklist /FI "IMAGENAME eq cloudflared.exe" /FO CSV /NH', { timeout: 5000 });
        const isRunning = taskList.includes('cloudflared.exe');

        // Get tunnel info if possible
        let tunnelInfo = null;
        if (isRunning) {
            try {
                // Try to get tunnel metrics
                const response = await fetch('http://localhost:45678/metrics', { timeout: 3000 });
                if (response.ok) {
                    tunnelInfo = { metricsAvailable: true };
                }
            } catch (e) {
                // Metrics not available
            }
        }

        res.json({
            success: true,
            cloudflared: {
                running: isRunning,
                tunnelInfo
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =============================================================================
// QDRANT MANAGEMENT API
// =============================================================================

// Get all Qdrant containers from docker-services.json
app.get('/api/v1/qdrant/containers', async (req, res) => {
    try {
        const dockerConfigPath = path.join(SERVICES_DIR, 'docker-services.json');

        if (!fs.existsSync(dockerConfigPath)) {
            return res.status(404).json({
                success: false,
                error: 'Docker services configuration not found'
            });
        }

        const dockerConfig = JSON.parse(fs.readFileSync(dockerConfigPath, 'utf8'));
        const qdrantContainers = dockerConfig.containers.filter(c =>
            c.image && c.image.toLowerCase().includes('qdrant')
        );

        res.json({
            success: true,
            containers: qdrantContainers
        });
    } catch (err) {
        console.error('[Qdrant] Error fetching containers:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Qdrant containers',
            message: err.message
        });
    }
});

// Get Qdrant status - checks if Qdrant is online and returns container/collection info
app.get('/api/v1/qdrant/status', async (req, res) => {
    const { host = 'localhost', port = 6333 } = req.query;

    try {
        // First check if Qdrant is responding
        const collectionsResponse = await new Promise((resolve, reject) => {
            const request = http.request({
                hostname: host,
                port: parseInt(port),
                path: '/collections',
                method: 'GET',
                timeout: 5000
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Connection timeout'));
            });
            request.end();
        });

        const collections = collectionsResponse.result?.collections || [];

        res.json({
            success: true,
            status: 'online',
            container: {
                name: 'INSPIRE08',
                host: host,
                port: parseInt(port),
                image: 'qdrant/qdrant:latest'
            },
            collections: collections.length
        });
    } catch (err) {
        console.error('[Qdrant] Status check failed:', err);
        res.json({
            success: false,
            status: 'offline',
            error: err.message
        });
    }
});

// Get all collections from a Qdrant instance
app.get('/api/v1/qdrant/collections', async (req, res) => {
    const { host = 'localhost', port = 6333 } = req.query;

    try {
        const response = await new Promise((resolve, reject) => {
            const request = http.request({
                hostname: host,
                port: parseInt(port),
                path: '/collections',
                method: 'GET',
                timeout: 5000
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Connection timeout'));
            });
            request.end();
        });

        res.json({
            success: true,
            host,
            port: parseInt(port),
            collections: response.result?.collections || []
        });
    } catch (err) {
        console.error('[Qdrant] Error fetching collections:', err);
        res.json({
            success: false,
            host,
            port: parseInt(port),
            error: err.message,
            collections: []
        });
    }
});

// Get collection details
app.get('/api/v1/qdrant/collections/:name', async (req, res) => {
    const { name } = req.params;
    const { host = 'localhost', port = 6333 } = req.query;

    try {
        const response = await new Promise((resolve, reject) => {
            const request = http.request({
                hostname: host,
                port: parseInt(port),
                path: `/collections/${encodeURIComponent(name)}`,
                method: 'GET',
                timeout: 5000
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Connection timeout'));
            });
            request.end();
        });

        const result = response.result || response;

        // Return collection details with proper structure for frontend
        res.json({
            success: true,
            name: name,
            collection: {
                points_count: result.points_count || 0,
                vectors_count: result.vectors_count || 0,
                status: result.status || 'unknown',
                config: result.config || {}
            }
        });
    } catch (err) {
        console.error('[Qdrant] Error fetching collection details:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get Qdrant cluster info
app.get('/api/v1/qdrant/cluster', async (req, res) => {
    const { host = 'localhost', port = 6333 } = req.query;

    try {
        const response = await new Promise((resolve, reject) => {
            const request = http.request({
                hostname: host,
                port: parseInt(port),
                path: '/cluster',
                method: 'GET',
                timeout: 5000
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Connection timeout'));
            });
            request.end();
        });

        res.json({
            success: true,
            cluster: response.result || response
        });
    } catch (err) {
        console.error('[Qdrant] Error fetching cluster info:', err);
        res.json({
            success: false,
            error: err.message
        });
    }
});

// Create a new collection
app.post('/api/v1/qdrant/collections', async (req, res) => {
    const { host = 'localhost', port = 6333 } = req.query;
    const { name, vectorSize = 1536, distance = 'Cosine' } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            error: 'Collection name is required'
        });
    }

    try {
        const payload = JSON.stringify({
            vectors: {
                size: parseInt(vectorSize),
                distance: distance
            }
        });

        const response = await new Promise((resolve, reject) => {
            const request = http.request({
                hostname: host,
                port: parseInt(port),
                path: `/collections/${encodeURIComponent(name)}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 10000
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve({ statusCode: response.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ statusCode: response.statusCode, data: data });
                    }
                });
            });

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Connection timeout'));
            });
            request.write(payload);
            request.end();
        });

        res.json({
            success: response.statusCode === 200,
            collection: name,
            result: response.data
        });
    } catch (err) {
        console.error('[Qdrant] Error creating collection:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Delete a collection
app.delete('/api/v1/qdrant/collections/:name', async (req, res) => {
    const { name } = req.params;
    const { host = 'localhost', port = 6333 } = req.query;

    try {
        const response = await new Promise((resolve, reject) => {
            const request = http.request({
                hostname: host,
                port: parseInt(port),
                path: `/collections/${encodeURIComponent(name)}`,
                method: 'DELETE',
                timeout: 10000
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve({ statusCode: response.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ statusCode: response.statusCode, data: data });
                    }
                });
            });

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Connection timeout'));
            });
            request.end();
        });

        res.json({
            success: response.statusCode === 200,
            collection: name,
            result: response.data
        });
    } catch (err) {
        console.error('[Qdrant] Error deleting collection:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} does not exist`,
        available_endpoints: {
            health: 'GET /health',
            status: 'GET /api/v1/status',
            developer: {
                projects: 'GET/POST /api/v1/developer/projects',
                tasks: 'GET/POST /api/v1/developer/tasks',
                taskById: 'GET/PUT /api/v1/developer/tasks/:id',
                complete: 'POST /api/v1/developer/tasks/:id/complete',
                activity: 'PUT /api/v1/developer/tasks/:id/activity',
                stats: 'GET /api/v1/developer/tasks/stats',
                sessionActive: 'GET /api/v1/developer/tasks/session/:sessionId/active'
            },
            codex: {
                users: 'GET /api/v1/codex/users',
                personas: 'GET /api/v1/codex/personas',
                config: 'GET /api/v1/codex/config',
                plans: 'GET /api/v1/codex/plans',
                languages: 'GET /api/v1/codex/languages',
                bible: 'GET /api/v1/codex/bible/verses'
            },
            inspire: {
                categories: 'GET /api/v1/inspire/categories',
                content: 'GET /api/v1/inspire/content',
                devotionals: 'GET /api/v1/inspire/devotionals',
                series: 'GET /api/v1/inspire/series',
                knowledge: 'GET /api/v1/inspire/knowledge'
            },
            sync: {
                push: 'POST /api/sync/push',
                pull: 'GET /api/sync/pull',
                preferences: 'GET/PUT /api/sync/preferences',
                status: 'GET /api/sync/status'
            },
            dailyNews: {
                cache: 'POST /api/v1/daily-news/cache',
                list: 'GET /api/v1/daily-news',
                get: 'GET /api/v1/daily-news/:id',
                image: 'GET /api/v1/daily-news/:id/image',
                stats: 'GET /api/v1/daily-news/stats',
                cleanup: 'DELETE /api/v1/daily-news/cleanup'
            },
            services: {
                list: 'GET /api/v1/services',
                byType: 'GET /api/v1/services/:type',
                update: 'PUT /api/v1/services/:type/:serviceName',
                bulkUpdate: 'PUT /api/v1/services/:type',
                reload: 'POST /api/v1/services/:type/reload',
                health: 'GET /api/v1/services/health/:type',
                check: 'GET /api/v1/services/check/:type (real HTTP health check)'
            },
            qdrant: {
                containers: 'GET /api/v1/qdrant/containers',
                collections: 'GET /api/v1/qdrant/collections',
                collectionDetails: 'GET /api/v1/qdrant/collections/:name',
                cluster: 'GET /api/v1/qdrant/cluster',
                createCollection: 'POST /api/v1/qdrant/collections',
                deleteCollection: 'DELETE /api/v1/qdrant/collections/:name'
            }
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startServer() {
    console.log('');
    console.log('═'.repeat(60));
    console.log('   InspireCodex API Server');
    console.log('═'.repeat(60));

    // Test database connections
    try {
        await codexPool.query('SELECT 1');
        console.log('✅ Codex database connected');

        // Ensure user_todos table exists
        await codexPool.query(`
            CREATE TABLE IF NOT EXISTS user_todos (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                title VARCHAR(500) NOT NULL,
                description TEXT,
                is_completed BOOLEAN DEFAULT FALSE,
                priority VARCHAR(20) DEFAULT 'medium',
                status VARCHAR(50) DEFAULT 'Pending',
                assigned_to VARCHAR(255),
                due_date TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_user_todos_email ON user_todos(user_email);
            CREATE INDEX IF NOT EXISTS idx_user_todos_completed ON user_todos(is_completed);
        `);

        // Add new columns if they don't exist (for existing tables)
        await codexPool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_todos' AND column_name='status') THEN
                    ALTER TABLE user_todos ADD COLUMN status VARCHAR(50) DEFAULT 'Pending';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_todos' AND column_name='assigned_to') THEN
                    ALTER TABLE user_todos ADD COLUMN assigned_to VARCHAR(255);
                END IF;
            END $$;
        `);

        // Insert sample todos for gabe.ungureanu@outlook.com if none exist
        const existingSamples = await codexPool.query(
            "SELECT COUNT(*) FROM user_todos WHERE user_email = 'gabe.ungureanu@outlook.com'"
        );
        if (parseInt(existingSamples.rows[0].count) === 0) {
            await codexPool.query(`
                INSERT INTO user_todos (user_email, title, description, priority, is_completed)
                VALUES
                    ('gabe.ungureanu@outlook.com', 'Review JubileeBrowser feature updates', 'Check the new sidebar panel and todo functionality', 'high', false),
                    ('gabe.ungureanu@outlook.com', 'Test InspireCodex API endpoints', 'Verify all CRUD operations work correctly', 'high', false),
                    ('gabe.ungureanu@outlook.com', 'Update documentation for Jubilee platform', 'Document the new todo feature and API changes', 'medium', false),
                    ('gabe.ungureanu@outlook.com', 'Schedule team sync meeting', 'Discuss upcoming sprint goals and priorities', 'medium', true),
                    ('gabe.ungureanu@outlook.com', 'Deploy latest changes to production', 'Push all updates to the live server', 'high', true)
            `);
            console.log('✅ Sample todos created for gabe.ungureanu@outlook.com');
        }

        console.log('✅ User todos table ready');
    } catch (err) {
        console.error('❌ Codex database connection failed:', err.message);
        process.exit(1);
    }

    try {
        await inspirePool.query('SELECT 1');
        console.log('✅ Inspire database connected');

        // Ensure daily_news_cache table exists for JubileeDailyNews service
        await inspirePool.query(`
            CREATE TABLE IF NOT EXISTS daily_news_cache (
                id SERIAL PRIMARY KEY,
                original_title TEXT NOT NULL,
                original_url TEXT,
                original_excerpt TEXT,
                rewritten_title TEXT NOT NULL,
                rewritten_content TEXT,
                source VARCHAR(50) NOT NULL,
                source_name VARCHAR(100),
                story_cluster VARCHAR(50),
                prominence_score INTEGER,
                rank INTEGER,
                image_data TEXT,
                image_mime_type VARCHAR(50),
                image_original_size INTEGER,
                image_final_size INTEGER,
                image_was_resized BOOLEAN DEFAULT FALSE,
                fetched_at TIMESTAMPTZ DEFAULT NOW(),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_daily_news_fetched_at ON daily_news_cache(fetched_at);
            CREATE INDEX IF NOT EXISTS idx_daily_news_source ON daily_news_cache(source);
            CREATE INDEX IF NOT EXISTS idx_daily_news_cluster ON daily_news_cache(story_cluster);
            CREATE INDEX IF NOT EXISTS idx_daily_news_prominence ON daily_news_cache(prominence_score DESC);
        `);
        console.log('✅ Daily news cache table ready');
    } catch (err) {
        console.error('❌ Inspire database connection failed:', err.message);
        process.exit(1);
    }

    if (legacyEnabled && legacyPool) {
        try {
            await legacyPool.query('SELECT 1');
            console.log('✅ Legacy database connected (read-only)');
        } catch (err) {
            console.warn('⚠️ Legacy database connection failed:', err.message);
        }
    }

    // Initialize Qdrant RAG service
    try {
        const ragReady = await qdrantService.initialize();
        if (ragReady) {
            console.log('✅ Qdrant RAG service connected');
        } else {
            const status = qdrantService.getStatus();
            console.warn('⚠️ Qdrant RAG service not available:', status.error);
        }
    } catch (err) {
        console.warn('⚠️ Qdrant RAG initialization failed:', err.message);
    }

    // Start server
    app.listen(PORT, () => {
        console.log('');
        console.log(`   Environment: ${NODE_ENV}`);
        console.log(`   Port: ${PORT}`);
        console.log(`   URL: http://localhost:${PORT}`);
        console.log('');
        console.log('═'.repeat(60));
        console.log('');
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await codexPool.end();
    await inspirePool.end();
    if (legacyPool) await legacyPool.end();
    process.exit(0);
});

startServer();
