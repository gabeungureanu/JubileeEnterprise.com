/**
 * InspireCodex API Server
 *
 * Backend API service for Codex (identity/configuration) and Inspire (ministry content) databases.
 * All client websites must consume Codex and Inspire data only through this API.
 *
 * Port: 3100
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3100;
const NODE_ENV = process.env.NODE_ENV || 'development';

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

// CORS configuration
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
    origin: corsOrigins.length > 0 ? corsOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV !== 'test') {
    app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
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

    res.status(health.status === 'ok' ? 200 : 503).json(health);
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
            memoryUsage: process.memoryUsage()
        }
    };

    // PostgreSQL Databases (lowercase names match actual PostgreSQL database names)
    const databases = ['codex', 'inspire', 'continuum'];

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

    // Website Availability Checks (HTTP HEAD requests)
    // All Jubilee Enterprise platform websites organized by category
    const websites = [
        // Codex Category - Core Infrastructure & APIs
        { name: 'JubileeVerse.com', url: 'http://localhost:3000', category: 'codex', type: 'app', description: 'AI Chat Platform' },
        { name: 'InspireCodex.com', url: 'http://localhost:3100', category: 'codex', type: 'api', description: 'Central API & Health Dashboard' },
        { name: 'InspireContinuum.com', url: 'http://localhost:3101', category: 'codex', type: 'api', description: 'User Activity & Admin Dashboard' },
        { name: 'JubileeBrowser.com', url: 'http://localhost:3200', category: 'codex', type: 'static', description: 'Browser Download Portal' },
        { name: 'wwBibleweb.com', url: 'http://localhost:3847', category: 'codex', type: 'static', description: 'IDNS Registry & Bible Web' },

        // Inspire Category - Ministry & Content Sites
        { name: 'JubileeInspire.com', url: 'http://localhost:3001', category: 'inspire', type: 'static', description: 'Ministry Landing Page' },
        { name: 'CelestialPaths.com', url: 'http://localhost:3300', category: 'inspire', type: 'static', description: 'Spiritual Journey Platform' },
    ];

    for (const site of websites) {
        try {
            const siteHealth = await new Promise((resolve) => {
                const startMs = Date.now();
                const req = http.get(site.url, { timeout: 5000 }, (res) => {
                    resolve({
                        name: site.name,
                        url: site.url,
                        category: site.category,
                        type: site.type,
                        description: site.description,
                        status: res.statusCode < 400 ? 'online' : 'error',
                        statusCode: res.statusCode,
                        responseTime: Date.now() - startMs
                    });
                });
                req.on('error', (err) => resolve({
                    name: site.name,
                    url: site.url,
                    category: site.category,
                    type: site.type,
                    description: site.description,
                    status: 'offline',
                    error: err.message
                }));
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        name: site.name,
                        url: site.url,
                        category: site.category,
                        type: site.type,
                        description: site.description,
                        status: 'timeout',
                        error: 'Connection timed out'
                    });
                });
            });

            health.websites.push(siteHealth);
        } catch (err) {
            health.websites.push({
                name: site.name,
                url: site.url,
                category: site.category,
                type: site.type,
                description: site.description,
                status: 'error',
                error: err.message
            });
        }
    }

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

// =============================================================================
// CODEX API ROUTES - Identity & Configuration
// =============================================================================

// Users
app.get('/api/v1/codex/users', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const result = await codexPool.query(`
            SELECT id, email, username, display_name, created_at, last_login_at, is_active
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
            SELECT id, email, username, display_name, created_at, last_login_at, is_active,
                   language_preference, default_persona_id
            FROM users WHERE id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user', message: err.message });
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
            SELECT domain_key, domain_type, display_name, mres, managed
            FROM idns_domains
            WHERE domain_key = $1 AND is_active = true
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
                    SELECT domain_key, domain_type, display_name, mres, managed
                    FROM idns_domains
                    WHERE domain_key = $1 AND is_active = true
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
            SELECT domain_key, domain_type, display_name, mres, managed, description
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

        query += ` ORDER BY display_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await codexPool.query(query, params);

        res.json({ domains: result.rows, count: result.rows.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch domains', message: err.message });
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
            error: 'An error occurred during login'
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
        const { email, password, displayName, username } = req.body;

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

        // Create user
        const result = await codexPool.query(
            `INSERT INTO users (id, email, password_hash, display_name, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'user', true, NOW(), NOW())
             RETURNING id, email, display_name, role`,
            [
                crypto.randomUUID(),
                email.toLowerCase(),
                passwordHash,
                displayName || email.split('@')[0]
            ]
        );

        const user = result.rows[0];

        // Generate tokens
        const accessToken = generateToken(user.id);
        const refreshToken = generateToken(user.id + '-refresh');

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                role: user.role
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
            error: 'An error occurred during registration'
        });
    }
});

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

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                role: user.role,
                preferredLanguage: user.preferred_language
            }
        });

    } catch (err) {
        console.error('Get user error:', err);
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
            deploy: 'POST /api/deploy (requires X-Deploy-Secret header)',
            auth: {
                login: 'POST /api/auth/login',
                register: 'POST /api/auth/register',
                logout: 'POST /api/auth/logout',
                refresh: 'POST /api/auth/refresh',
                me: 'GET /api/auth/me'
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
            'sync-v2': {
                registerDevice: 'POST /api/sync/v2/devices/register',
                getCollections: 'GET /api/sync/v2/collections',
                commit: 'POST /api/sync/v2/collections/:type/commit',
                getUpdates: 'GET /api/sync/v2/collections/:type/updates',
                acknowledge: 'POST /api/sync/v2/collections/:type/acknowledge',
                getProgress: 'GET /api/sync/v2/devices/:deviceId/progress',
                fullSync: 'GET /api/sync/v2/collections/:type/full'
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
    } catch (err) {
        console.error('❌ Codex database connection failed:', err.message);
        process.exit(1);
    }

    try {
        await inspirePool.query('SELECT 1');
        console.log('✅ Inspire database connected');
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
