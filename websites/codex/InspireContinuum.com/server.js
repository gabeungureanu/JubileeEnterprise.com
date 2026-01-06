/**
 * InspireContinuum API Server
 *
 * Backend API service for Continuum database (user activity, chat logs, high-volume data).
 * This service is logically and operationally distinct from InspireCodex to prevent
 * high-volume traffic from destabilizing the foundational layer.
 *
 * All Continuum reads/writes go through this service and reference user identity
 * using global user identifiers issued by Codex.
 *
 * Port: 3101
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3101;
const NODE_ENV = process.env.NODE_ENV || 'development';

// =============================================================================
// DATABASE CONNECTIONS
// =============================================================================

const getDbConfig = (dbType) => {
    const isProd = NODE_ENV === 'production';
    const prefix = isProd ? 'PROD_' : '';

    return {
        host: process.env[`${prefix}${dbType}_DB_HOST`] || 'localhost',
        port: parseInt(process.env[`${prefix}${dbType}_DB_PORT`] || '5432'),
        database: process.env[`${prefix}${dbType}_DB_NAME`] || dbType,
        user: process.env[`${prefix}${dbType}_DB_USER`] || 'guardian',
        password: process.env[`${prefix}${dbType}_DB_PASSWORD`],
        max: 30, // Higher pool size for high-volume operations
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
};

// Continuum pool (primary for this service)
const continuumPool = new Pool(getDbConfig('CONTINUUM'));

// Codex pool (for user identity lookups - read-only from this service)
const codexPool = new Pool({
    ...getDbConfig('CODEX'),
    max: 5, // Lower pool size - just for identity lookups
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(helmet({ contentSecurityPolicy: false }));

const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
    origin: corsOrigins.length > 0 ? corsOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-Id'],
    credentials: true,
}));

app.use(express.json({ limit: '50mb' })); // Higher limit for chat content
app.use(express.urlencoded({ extended: true }));

if (NODE_ENV !== 'test') {
    app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Higher rate limits for activity tracking
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200'),
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Verify user exists in Codex
async function verifyUser(userId) {
    try {
        const result = await codexPool.query(
            'SELECT id, email, display_name FROM users WHERE id = $1',
            [userId]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
        console.error('Error verifying user:', err.message);
        return null;
    }
}

// User ID middleware
const requireUserId = async (req, res, next) => {
    const userId = req.headers['x-user-id'] || req.query.user_id || req.body?.user_id;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await verifyUser(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found in Codex' });
    }

    req.userId = userId;
    req.user = user;
    next();
};

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

    try {
        await continuumPool.query('SELECT 1');
        health.databases.continuum = 'connected';
    } catch (err) {
        health.databases.continuum = 'error: ' + err.message;
        health.status = 'degraded';
    }

    try {
        await codexPool.query('SELECT 1');
        health.databases.codex = 'connected (identity lookup)';
    } catch (err) {
        health.databases.codex = 'error: ' + err.message;
        health.status = 'degraded';
    }

    res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.get('/api/v1/status', async (req, res) => {
    try {
        const stats = await continuumPool.query(`
            SELECT
                (SELECT COUNT(*) FROM chat_conversations) as conversations,
                (SELECT COUNT(*) FROM chat_messages) as messages,
                (SELECT COUNT(*) FROM activity_events) as events,
                (SELECT COUNT(*) FROM user_content) as user_content
        `);

        res.json({
            api: 'InspireContinuum',
            version: '1.0.0',
            environment: NODE_ENV,
            timestamp: new Date().toISOString(),
            statistics: {
                conversations: parseInt(stats.rows[0].conversations || 0),
                messages: parseInt(stats.rows[0].messages || 0),
                events: parseInt(stats.rows[0].events || 0),
                userContent: parseInt(stats.rows[0].user_content || 0)
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get status', message: err.message });
    }
});

// =============================================================================
// ACTIVITY SESSION ROUTES
// =============================================================================

// Create new activity session
app.post('/api/v1/sessions', requireUserId, async (req, res) => {
    try {
        const { ip_address, user_agent, device_info, location_info } = req.body;

        const result = await continuumPool.query(`
            INSERT INTO activity_sessions (user_id, session_token, ip_address, user_agent, device_info, location_info)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.userId, uuidv4(), ip_address, user_agent, device_info || {}, location_info || {}]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create session', message: err.message });
    }
});

// End activity session
app.patch('/api/v1/sessions/:id/end', async (req, res) => {
    try {
        const result = await continuumPool.query(`
            UPDATE activity_sessions
            SET ended_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to end session', message: err.message });
    }
});

// Get user sessions
app.get('/api/v1/sessions', requireUserId, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const result = await continuumPool.query(`
            SELECT * FROM activity_sessions
            WHERE user_id = $1
            ORDER BY started_at DESC
            LIMIT $2 OFFSET $3
        `, [req.userId, limit, offset]);

        res.json({ sessions: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sessions', message: err.message });
    }
});

// =============================================================================
// ACTIVITY EVENT ROUTES
// =============================================================================

// Track activity event
app.post('/api/v1/events', requireUserId, async (req, res) => {
    try {
        const { session_id, event_type, event_category, event_data, page_url, referrer_url } = req.body;

        if (!event_type) {
            return res.status(400).json({ error: 'event_type is required' });
        }

        const result = await continuumPool.query(`
            INSERT INTO activity_events (session_id, user_id, event_type, event_category, event_data, page_url, referrer_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [session_id, req.userId, event_type, event_category, event_data || {}, page_url, referrer_url]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to track event', message: err.message });
    }
});

// Batch track events (for high-volume tracking)
app.post('/api/v1/events/batch', requireUserId, async (req, res) => {
    try {
        const { events } = req.body;

        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ error: 'events array is required' });
        }

        const client = await continuumPool.connect();
        try {
            await client.query('BEGIN');

            const insertedEvents = [];
            for (const event of events) {
                const result = await client.query(`
                    INSERT INTO activity_events (session_id, user_id, event_type, event_category, event_data, page_url, referrer_url)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                `, [event.session_id, req.userId, event.event_type, event.event_category, event.event_data || {}, event.page_url, event.referrer_url]);
                insertedEvents.push(result.rows[0].id);
            }

            await client.query('COMMIT');
            res.status(201).json({ inserted: insertedEvents.length, ids: insertedEvents });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to batch track events', message: err.message });
    }
});

// =============================================================================
// CHAT CONVERSATION ROUTES
// =============================================================================

// Create conversation
app.post('/api/v1/conversations', requireUserId, async (req, res) => {
    try {
        const { persona_id, title, metadata } = req.body;

        const result = await continuumPool.query(`
            INSERT INTO chat_conversations (user_id, persona_id, title, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [req.userId, persona_id, title, metadata || {}]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create conversation', message: err.message });
    }
});

// Get user conversations
app.get('/api/v1/conversations', requireUserId, async (req, res) => {
    try {
        const { status = 'active', limit = 50, offset = 0 } = req.query;

        const result = await continuumPool.query(`
            SELECT * FROM chat_conversations
            WHERE user_id = $1 AND status = $2
            ORDER BY last_message_at DESC NULLS LAST, started_at DESC
            LIMIT $3 OFFSET $4
        `, [req.userId, status, limit, offset]);

        const countResult = await continuumPool.query(`
            SELECT COUNT(*) FROM chat_conversations WHERE user_id = $1 AND status = $2
        `, [req.userId, status]);

        res.json({
            conversations: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch conversations', message: err.message });
    }
});

// Get single conversation
app.get('/api/v1/conversations/:id', async (req, res) => {
    try {
        const result = await continuumPool.query(`
            SELECT * FROM chat_conversations WHERE id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch conversation', message: err.message });
    }
});

// Update conversation status
app.patch('/api/v1/conversations/:id', async (req, res) => {
    try {
        const { status, title } = req.body;

        const updates = [];
        const values = [];
        let paramCount = 0;

        if (status) {
            values.push(status);
            updates.push(`status = $${++paramCount}`);
        }
        if (title) {
            values.push(title);
            updates.push(`title = $${++paramCount}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        values.push(req.params.id);
        const result = await continuumPool.query(`
            UPDATE chat_conversations
            SET ${updates.join(', ')}
            WHERE id = $${++paramCount}
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update conversation', message: err.message });
    }
});

// =============================================================================
// CHAT MESSAGE ROUTES
// =============================================================================

// Add message to conversation
app.post('/api/v1/conversations/:conversationId/messages', async (req, res) => {
    try {
        const { role, content, tokens_used, model_used, response_time_ms, metadata } = req.body;

        if (!role || !content) {
            return res.status(400).json({ error: 'role and content are required' });
        }

        const client = await continuumPool.connect();
        try {
            await client.query('BEGIN');

            // Insert message
            const messageResult = await client.query(`
                INSERT INTO chat_messages (conversation_id, role, content, tokens_used, model_used, response_time_ms, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [req.params.conversationId, role, content, tokens_used || 0, model_used, response_time_ms, metadata || {}]);

            // Update conversation stats
            await client.query(`
                UPDATE chat_conversations
                SET message_count = message_count + 1,
                    total_tokens_used = total_tokens_used + $1,
                    last_message_at = NOW()
                WHERE id = $2
            `, [tokens_used || 0, req.params.conversationId]);

            await client.query('COMMIT');
            res.status(201).json(messageResult.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to add message', message: err.message });
    }
});

// Get messages for conversation
app.get('/api/v1/conversations/:conversationId/messages', async (req, res) => {
    try {
        const { limit = 100, offset = 0, order = 'asc' } = req.query;
        const orderDir = order === 'desc' ? 'DESC' : 'ASC';

        const result = await continuumPool.query(`
            SELECT * FROM chat_messages
            WHERE conversation_id = $1
            ORDER BY created_at ${orderDir}
            LIMIT $2 OFFSET $3
        `, [req.params.conversationId, limit, offset]);

        res.json({ messages: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages', message: err.message });
    }
});

// Add reaction to message
app.post('/api/v1/messages/:messageId/reactions', requireUserId, async (req, res) => {
    try {
        const { reaction_type } = req.body;

        if (!reaction_type) {
            return res.status(400).json({ error: 'reaction_type is required' });
        }

        const result = await continuumPool.query(`
            INSERT INTO message_reactions (message_id, user_id, reaction_type)
            VALUES ($1, $2, $3)
            ON CONFLICT (message_id, user_id, reaction_type) DO NOTHING
            RETURNING *
        `, [req.params.messageId, req.userId, reaction_type]);

        res.status(201).json(result.rows[0] || { message: 'Reaction already exists' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add reaction', message: err.message });
    }
});

// =============================================================================
// USER CONTENT ROUTES
// =============================================================================

// Create user content
app.post('/api/v1/content', requireUserId, async (req, res) => {
    try {
        const { content_type, title, body, is_private = true, tags } = req.body;

        if (!content_type) {
            return res.status(400).json({ error: 'content_type is required' });
        }

        const result = await continuumPool.query(`
            INSERT INTO user_content (user_id, content_type, title, body, is_private, tags)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.userId, content_type, title, body, is_private, tags || []]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create content', message: err.message });
    }
});

// Get user content
app.get('/api/v1/content', requireUserId, async (req, res) => {
    try {
        const { content_type, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT * FROM user_content
            WHERE user_id = $1
        `;
        const params = [req.userId];
        let paramCount = 1;

        if (content_type) {
            params.push(content_type);
            query += ` AND content_type = $${++paramCount}`;
        }

        params.push(parseInt(limit));
        params.push(parseInt(offset));
        query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;

        const result = await continuumPool.query(query, params);
        res.json({ content: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch content', message: err.message });
    }
});

// =============================================================================
// USER ANNOTATIONS ROUTES
// =============================================================================

// Create annotation
app.post('/api/v1/annotations', requireUserId, async (req, res) => {
    try {
        const { target_type, target_id, annotation_type, content, color, metadata } = req.body;

        if (!target_type || !target_id) {
            return res.status(400).json({ error: 'target_type and target_id are required' });
        }

        const result = await continuumPool.query(`
            INSERT INTO user_annotations (user_id, target_type, target_id, annotation_type, content, color, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [req.userId, target_type, target_id, annotation_type, content, color, metadata || {}]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create annotation', message: err.message });
    }
});

// Get user annotations
app.get('/api/v1/annotations', requireUserId, async (req, res) => {
    try {
        const { target_type, target_id, limit = 100 } = req.query;

        let query = 'SELECT * FROM user_annotations WHERE user_id = $1';
        const params = [req.userId];
        let paramCount = 1;

        if (target_type) {
            params.push(target_type);
            query += ` AND target_type = $${++paramCount}`;
        }
        if (target_id) {
            params.push(target_id);
            query += ` AND target_id = $${++paramCount}`;
        }

        params.push(parseInt(limit));
        query += ` ORDER BY created_at DESC LIMIT $${++paramCount}`;

        const result = await continuumPool.query(query, params);
        res.json({ annotations: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch annotations', message: err.message });
    }
});

// =============================================================================
// READING PROGRESS ROUTES
// =============================================================================

// Track reading progress
app.post('/api/v1/progress', requireUserId, async (req, res) => {
    try {
        const { plan_id, content_id, day_number, completed = false, notes } = req.body;

        const result = await continuumPool.query(`
            INSERT INTO reading_progress (user_id, plan_id, content_id, day_number, completed, completed_at, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [req.userId, plan_id, content_id, day_number, completed, completed ? new Date() : null, notes]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to track progress', message: err.message });
    }
});

// Get reading progress
app.get('/api/v1/progress', requireUserId, async (req, res) => {
    try {
        const { plan_id } = req.query;

        let query = 'SELECT * FROM reading_progress WHERE user_id = $1';
        const params = [req.userId];

        if (plan_id) {
            params.push(plan_id);
            query += ` AND plan_id = $2`;
        }

        query += ' ORDER BY day_number, created_at';

        const result = await continuumPool.query(query, params);
        res.json({ progress: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch progress', message: err.message });
    }
});

// =============================================================================
// ANALYTICS EVENTS ROUTES
// =============================================================================

// Track analytics event
app.post('/api/v1/analytics', async (req, res) => {
    try {
        const { user_id, event_name, event_properties, session_id, platform, app_version } = req.body;

        if (!event_name) {
            return res.status(400).json({ error: 'event_name is required' });
        }

        const result = await continuumPool.query(`
            INSERT INTO analytics_events (user_id, event_name, event_properties, session_id, platform, app_version)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [user_id, event_name, event_properties || {}, session_id, platform, app_version]);

        res.status(201).json({ id: result.rows[0].id, tracked: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to track analytics', message: err.message });
    }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} does not exist`,
        available_endpoints: {
            health: 'GET /health',
            status: 'GET /api/v1/status',
            sessions: 'POST /api/v1/sessions, GET /api/v1/sessions',
            events: 'POST /api/v1/events, POST /api/v1/events/batch',
            conversations: 'GET/POST /api/v1/conversations',
            messages: 'GET/POST /api/v1/conversations/:id/messages',
            content: 'GET/POST /api/v1/content',
            annotations: 'GET/POST /api/v1/annotations',
            progress: 'GET/POST /api/v1/progress',
            analytics: 'POST /api/v1/analytics'
        }
    });
});

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
    console.log('   InspireContinuum API Server');
    console.log('═'.repeat(60));

    try {
        await continuumPool.query('SELECT 1');
        console.log('✅ Continuum database connected');
    } catch (err) {
        console.error('❌ Continuum database connection failed:', err.message);
        process.exit(1);
    }

    try {
        await codexPool.query('SELECT 1');
        console.log('✅ Codex database connected (identity lookup)');
    } catch (err) {
        console.warn('⚠️ Codex database connection failed:', err.message);
    }

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

process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await continuumPool.end();
    await codexPool.end();
    process.exit(0);
});

startServer();
