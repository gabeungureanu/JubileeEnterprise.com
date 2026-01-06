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

    // PostgreSQL Databases
    const databases = ['Codex', 'Inspire', 'Continuum', 'JubileeVerse'];

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
    const websites = [
        { name: 'JubileeVerse.com', url: 'http://localhost:3000' },
        { name: 'InspireCodex.com', url: 'http://localhost:3100' },
        { name: 'InspireContinuum.com', url: 'http://localhost:3101' },
        { name: 'wwBibleweb.com', url: 'http://localhost:3847' },
    ];

    for (const site of websites) {
        try {
            const siteHealth = await new Promise((resolve) => {
                const startMs = Date.now();
                const req = http.get(site.url, { timeout: 5000 }, (res) => {
                    resolve({
                        name: site.name,
                        url: site.url,
                        status: res.statusCode < 400 ? 'online' : 'error',
                        statusCode: res.statusCode,
                        responseTime: Date.now() - startMs
                    });
                });
                req.on('error', (err) => resolve({
                    name: site.name,
                    url: site.url,
                    status: 'offline',
                    error: err.message
                }));
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        name: site.name,
                        url: site.url,
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
            database: 'Codex',
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
