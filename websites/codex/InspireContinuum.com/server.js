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
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3101;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for proper client IP detection behind Cloudflare/reverse proxy
app.set('trust proxy', 1);

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
// ADMIN DASHBOARD API
// =============================================================================

// Dashboard data endpoint - aggregates user data from Codex and metrics from Continuum
app.get('/api/v1/admin/dashboard', async (req, res) => {
    try {
        // Get all users from Codex (read-only)
        const usersResult = await codexPool.query(`
            SELECT id, email, display_name, avatar_url, role, is_active,
                   last_login_at, created_at
            FROM users
            ORDER BY last_login_at DESC NULLS LAST, created_at DESC
        `);

        // Get active sessions from Codex
        const sessionsResult = await codexPool.query(`
            SELECT sid, sess, expire
            FROM session
            WHERE expire > NOW()
        `);

        // Parse sessions to determine active users
        const activeSessions = sessionsResult.rows.map(row => {
            const sessData = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
            return {
                user_id: sessData.userId || row.sid,
                is_active: true,
                last_heartbeat: row.expire,
                client_type: sessData.client_type || 'web'
            };
        });

        // Get activity sessions from Continuum (if any)
        let continuumSessions = [];
        try {
            const continuumSessionsResult = await continuumPool.query(`
                SELECT user_id, session_token, client_type, browser_id,
                       started_at, ended_at, last_heartbeat, is_active
                FROM activity_sessions
                WHERE is_active = true
                   OR last_heartbeat > NOW() - INTERVAL '5 minutes'
                ORDER BY last_heartbeat DESC
            `);
            continuumSessions = continuumSessionsResult.rows;
        } catch (err) {
            // Table may not exist yet, ignore
        }

        // Merge session data
        const allSessions = [...activeSessions, ...continuumSessions];

        // Calculate browser sessions (Jubilee Browser)
        const browserSessions = allSessions.filter(s =>
            s.client_type === 'jubilee_browser' || s.browser_id
        ).length;

        // Get Continuum metrics
        let metrics = {
            sessions: 0,
            events: 0,
            conversations: 0,
            messages: 0,
            userContent: 0,
            annotations: 0,
            readingProgress: 0,
            analytics: 0
        };

        try {
            const metricsResult = await continuumPool.query(`
                SELECT
                    (SELECT COUNT(*) FROM activity_sessions) as sessions,
                    (SELECT COUNT(*) FROM activity_events) as events,
                    (SELECT COUNT(*) FROM chat_conversations) as conversations,
                    (SELECT COUNT(*) FROM chat_messages) as messages,
                    (SELECT COUNT(*) FROM user_content) as user_content,
                    (SELECT COUNT(*) FROM user_annotations) as annotations,
                    (SELECT COUNT(*) FROM reading_progress) as reading_progress,
                    (SELECT COUNT(*) FROM analytics_events) as analytics
            `);

            if (metricsResult.rows[0]) {
                metrics = {
                    sessions: parseInt(metricsResult.rows[0].sessions || 0),
                    events: parseInt(metricsResult.rows[0].events || 0),
                    conversations: parseInt(metricsResult.rows[0].conversations || 0),
                    messages: parseInt(metricsResult.rows[0].messages || 0),
                    userContent: parseInt(metricsResult.rows[0].user_content || 0),
                    annotations: parseInt(metricsResult.rows[0].annotations || 0),
                    readingProgress: parseInt(metricsResult.rows[0].reading_progress || 0),
                    analytics: parseInt(metricsResult.rows[0].analytics || 0)
                };
            }
        } catch (err) {
            // Tables may not exist yet
        }

        // Get recent activity events
        let recentActivity = [];
        try {
            const activityResult = await continuumPool.query(`
                SELECT event_type, event_category, created_at
                FROM activity_events
                ORDER BY created_at DESC
                LIMIT 20
            `);
            recentActivity = activityResult.rows;
        } catch (err) {
            // Table may not exist
        }

        // Calculate active users (users with non-expired sessions)
        const activeUserIds = new Set(allSessions.map(s => s.user_id));
        const activeUsers = activeUserIds.size;

        res.json({
            timestamp: new Date().toISOString(),
            summary: {
                totalUsers: usersResult.rows.length,
                activeUsers: activeUsers,
                browserSessions: browserSessions
            },
            users: usersResult.rows,
            sessions: allSessions,
            metrics: metrics,
            recentActivity: recentActivity
        });

    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({
            error: 'Failed to fetch dashboard data',
            message: err.message
        });
    }
});

// Heartbeat endpoint for tracking active browser sessions
app.post('/api/v1/admin/heartbeat', async (req, res) => {
    try {
        const { user_id, session_id, client_type, browser_id, device_info } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        if (!browser_id) {
            return res.status(400).json({ error: 'browser_id is required for browser sessions' });
        }

        // Upsert session - use browser_id as unique identifier for the session
        const result = await continuumPool.query(`
            INSERT INTO activity_sessions (user_id, session_token, client_type, browser_id, device_info, last_heartbeat, is_active, started_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), true, NOW())
            ON CONFLICT (user_id, browser_id) WHERE browser_id IS NOT NULL
            DO UPDATE SET
                last_heartbeat = NOW(),
                is_active = true,
                device_info = COALESCE($5, activity_sessions.device_info)
            RETURNING id
        `, [user_id, session_id || uuidv4(), client_type || 'jubilee_browser', browser_id, device_info || {}]);

        res.json({
            success: true,
            session_id: result.rows[0]?.id,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Heartbeat error:', err);
        res.status(500).json({ error: 'Failed to record heartbeat', message: err.message });
    }
});

// Endpoint to end a browser session (on sign out)
app.post('/api/v1/admin/session/end', async (req, res) => {
    try {
        const { user_id, browser_id } = req.body;

        if (!user_id || !browser_id) {
            return res.status(400).json({ error: 'user_id and browser_id are required' });
        }

        await continuumPool.query(`
            UPDATE activity_sessions
            SET is_active = false, ended_at = NOW()
            WHERE user_id = $1 AND browser_id = $2
        `, [user_id, browser_id]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to end session', message: err.message });
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
// JUBILEE OUTLOOK - CALENDAR ROUTES
// =============================================================================

// Get calendars for user
app.get('/api/v1/outlook/calendars', requireUserId, async (req, res) => {
    try {
        const result = await continuumPool.query(`
            SELECT * FROM outlook_calendars
            WHERE user_id = $1
            ORDER BY is_default DESC, name
        `, [req.userId]);

        res.json({ calendars: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch calendars', message: err.message });
    }
});

// Create calendar
app.post('/api/v1/outlook/calendars', requireUserId, async (req, res) => {
    try {
        const { name, description, color, is_default, time_zone } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Calendar name is required' });
        }

        const result = await continuumPool.query(`
            INSERT INTO outlook_calendars (user_id, name, description, color, is_default, time_zone)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.userId, name, description, color || '#0078D4', is_default || false, time_zone || 'UTC']);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create calendar', message: err.message });
    }
});

// Get calendar events
app.get('/api/v1/outlook/events', async (req, res) => {
    try {
        const { userId, user_id, startDate, endDate, calendarId } = req.query;
        const effectiveUserId = userId || user_id;

        if (!effectiveUserId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        let query = `
            SELECT e.*, c.name as calendar_name
            FROM outlook_calendar_events e
            LEFT JOIN outlook_calendars c ON e.calendar_id = c.id
            WHERE e.user_id = $1
        `;
        const params = [effectiveUserId];
        let paramCount = 1;

        if (startDate) {
            params.push(startDate);
            query += ` AND e.start_time >= $${++paramCount}`;
        }
        if (endDate) {
            params.push(endDate);
            query += ` AND e.end_time <= $${++paramCount}`;
        }
        if (calendarId) {
            params.push(calendarId);
            query += ` AND e.calendar_id = $${++paramCount}`;
        }

        query += ' ORDER BY e.start_time';

        const result = await continuumPool.query(query, params);

        // Get attendees for each event
        const events = await Promise.all(result.rows.map(async (event) => {
            const attendeesResult = await continuumPool.query(`
                SELECT attendee_email, attendee_name, response_status, is_required
                FROM outlook_event_attendees
                WHERE event_id = $1
            `, [event.id]);

            const attachmentsResult = await continuumPool.query(`
                SELECT id, file_name, file_path, file_size, mime_type, created_at as added_date
                FROM outlook_event_attachments
                WHERE event_id = $1
            `, [event.id]);

            return {
                id: event.id,
                calendarId: event.calendar_id,
                subject: event.subject,
                location: event.location,
                description: event.description,
                startTime: event.start_time,
                endTime: event.end_time,
                isAllDay: event.is_all_day,
                status: event.status,
                category: event.category,
                eventColor: event.event_color,
                calendarName: event.calendar_name || 'My Calendar',
                attendees: attendeesResult.rows.map(a => a.attendee_email),
                attachments: attachmentsResult.rows.map(a => ({
                    id: a.id,
                    fileName: a.file_name,
                    filePath: a.file_path,
                    fileSize: a.file_size,
                    addedDate: a.added_date
                })),
                isRecurring: event.is_recurring,
                reminderMinutes: event.reminder_minutes
            };
        }));

        res.json(events);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch events', message: err.message });
    }
});

// Get single event
app.get('/api/v1/outlook/events/:id', async (req, res) => {
    try {
        const result = await continuumPool.query(`
            SELECT e.*, c.name as calendar_name
            FROM outlook_calendar_events e
            LEFT JOIN outlook_calendars c ON e.calendar_id = c.id
            WHERE e.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = result.rows[0];

        const attendeesResult = await continuumPool.query(`
            SELECT attendee_email, attendee_name, response_status, is_required
            FROM outlook_event_attendees
            WHERE event_id = $1
        `, [event.id]);

        const attachmentsResult = await continuumPool.query(`
            SELECT id, file_name, file_path, file_size, mime_type, created_at as added_date
            FROM outlook_event_attachments
            WHERE event_id = $1
        `, [event.id]);

        res.json({
            id: event.id,
            calendarId: event.calendar_id,
            subject: event.subject,
            location: event.location,
            description: event.description,
            startTime: event.start_time,
            endTime: event.end_time,
            isAllDay: event.is_all_day,
            status: event.status,
            category: event.category,
            eventColor: event.event_color,
            calendarName: event.calendar_name || 'My Calendar',
            attendees: attendeesResult.rows.map(a => a.attendee_email),
            attachments: attachmentsResult.rows.map(a => ({
                id: a.id,
                fileName: a.file_name,
                filePath: a.file_path,
                fileSize: a.file_size,
                addedDate: a.added_date
            })),
            isRecurring: event.is_recurring,
            reminderMinutes: event.reminder_minutes
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch event', message: err.message });
    }
});

// Create calendar event
app.post('/api/v1/outlook/events', async (req, res) => {
    try {
        const {
            userId, user_id, calendarId, calendar_id,
            subject, location, description,
            startTime, start_time, endTime, end_time,
            isAllDay, is_all_day, status, category,
            eventColor, event_color, isRecurring, is_recurring,
            reminderMinutes, reminder_minutes,
            attendees, attachments
        } = req.body;

        const effectiveUserId = userId || user_id;
        const effectiveStartTime = startTime || start_time;
        const effectiveEndTime = endTime || end_time;
        const effectiveCalendarId = calendarId || calendar_id;
        const effectiveIsAllDay = isAllDay ?? is_all_day ?? false;
        const effectiveEventColor = eventColor || event_color || '#5B9BD5';
        const effectiveIsRecurring = isRecurring ?? is_recurring ?? false;
        const effectiveReminderMinutes = reminderMinutes ?? reminder_minutes ?? 15;

        if (!effectiveUserId || !subject || !effectiveStartTime || !effectiveEndTime) {
            return res.status(400).json({ error: 'userId, subject, startTime, and endTime are required' });
        }

        const client = await continuumPool.connect();
        try {
            await client.query('BEGIN');

            // Get or create default calendar for user
            let calendarIdToUse = effectiveCalendarId;
            if (!calendarIdToUse) {
                const calResult = await client.query(`
                    SELECT id FROM outlook_calendars WHERE user_id = $1 AND is_default = true
                `, [effectiveUserId]);

                if (calResult.rows.length === 0) {
                    const newCalResult = await client.query(`
                        INSERT INTO outlook_calendars (user_id, name, is_default)
                        VALUES ($1, 'My Calendar', true)
                        RETURNING id
                    `, [effectiveUserId]);
                    calendarIdToUse = newCalResult.rows[0].id;
                } else {
                    calendarIdToUse = calResult.rows[0].id;
                }
            }

            // Insert event
            const eventResult = await client.query(`
                INSERT INTO outlook_calendar_events (
                    calendar_id, user_id, subject, location, description,
                    start_time, end_time, is_all_day, status, category,
                    event_color, is_recurring, reminder_minutes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `, [
                calendarIdToUse, effectiveUserId, subject, location || '', description || '',
                effectiveStartTime, effectiveEndTime, effectiveIsAllDay, status || 'free', category || '',
                effectiveEventColor, effectiveIsRecurring, effectiveReminderMinutes
            ]);

            const newEvent = eventResult.rows[0];

            // Insert attendees
            if (Array.isArray(attendees) && attendees.length > 0) {
                for (const attendee of attendees) {
                    const email = typeof attendee === 'string' ? attendee : attendee.email;
                    const name = typeof attendee === 'string' ? null : attendee.name;
                    await client.query(`
                        INSERT INTO outlook_event_attendees (event_id, attendee_email, attendee_name)
                        VALUES ($1, $2, $3)
                    `, [newEvent.id, email, name]);
                }
            }

            // Insert attachments
            if (Array.isArray(attachments) && attachments.length > 0) {
                for (const att of attachments) {
                    await client.query(`
                        INSERT INTO outlook_event_attachments (event_id, file_name, file_path, file_size, mime_type)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [newEvent.id, att.fileName || att.file_name, att.filePath || att.file_path, att.fileSize || att.file_size || 0, att.mimeType || att.mime_type]);
                }
            }

            await client.query('COMMIT');

            res.status(201).json({
                id: newEvent.id,
                calendarId: newEvent.calendar_id,
                subject: newEvent.subject,
                location: newEvent.location,
                description: newEvent.description,
                startTime: newEvent.start_time,
                endTime: newEvent.end_time,
                isAllDay: newEvent.is_all_day,
                status: newEvent.status,
                category: newEvent.category,
                eventColor: newEvent.event_color,
                isRecurring: newEvent.is_recurring,
                reminderMinutes: newEvent.reminder_minutes
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to create event', message: err.message });
    }
});

// Update calendar event
app.put('/api/v1/outlook/events/:id', async (req, res) => {
    try {
        const {
            subject, location, description,
            startTime, start_time, endTime, end_time,
            isAllDay, is_all_day, status, category,
            eventColor, event_color, isRecurring, is_recurring,
            reminderMinutes, reminder_minutes,
            attendees, attachments
        } = req.body;

        const effectiveStartTime = startTime || start_time;
        const effectiveEndTime = endTime || end_time;
        const effectiveIsAllDay = isAllDay ?? is_all_day;
        const effectiveEventColor = eventColor || event_color;
        const effectiveIsRecurring = isRecurring ?? is_recurring;
        const effectiveReminderMinutes = reminderMinutes ?? reminder_minutes;

        const client = await continuumPool.connect();
        try {
            await client.query('BEGIN');

            // Update event
            const result = await client.query(`
                UPDATE outlook_calendar_events SET
                    subject = COALESCE($1, subject),
                    location = COALESCE($2, location),
                    description = COALESCE($3, description),
                    start_time = COALESCE($4, start_time),
                    end_time = COALESCE($5, end_time),
                    is_all_day = COALESCE($6, is_all_day),
                    status = COALESCE($7, status),
                    category = COALESCE($8, category),
                    event_color = COALESCE($9, event_color),
                    is_recurring = COALESCE($10, is_recurring),
                    reminder_minutes = COALESCE($11, reminder_minutes),
                    updated_at = NOW()
                WHERE id = $12
                RETURNING *
            `, [
                subject, location, description,
                effectiveStartTime, effectiveEndTime, effectiveIsAllDay,
                status, category, effectiveEventColor,
                effectiveIsRecurring, effectiveReminderMinutes,
                req.params.id
            ]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Event not found' });
            }

            const updatedEvent = result.rows[0];

            // Update attendees if provided
            if (Array.isArray(attendees)) {
                await client.query('DELETE FROM outlook_event_attendees WHERE event_id = $1', [req.params.id]);
                for (const attendee of attendees) {
                    const email = typeof attendee === 'string' ? attendee : attendee.email;
                    const name = typeof attendee === 'string' ? null : attendee.name;
                    await client.query(`
                        INSERT INTO outlook_event_attendees (event_id, attendee_email, attendee_name)
                        VALUES ($1, $2, $3)
                    `, [req.params.id, email, name]);
                }
            }

            // Update attachments if provided
            if (Array.isArray(attachments)) {
                await client.query('DELETE FROM outlook_event_attachments WHERE event_id = $1', [req.params.id]);
                for (const att of attachments) {
                    await client.query(`
                        INSERT INTO outlook_event_attachments (event_id, file_name, file_path, file_size, mime_type)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [req.params.id, att.fileName || att.file_name, att.filePath || att.file_path, att.fileSize || att.file_size || 0, att.mimeType || att.mime_type]);
                }
            }

            await client.query('COMMIT');

            res.json({
                id: updatedEvent.id,
                calendarId: updatedEvent.calendar_id,
                subject: updatedEvent.subject,
                location: updatedEvent.location,
                description: updatedEvent.description,
                startTime: updatedEvent.start_time,
                endTime: updatedEvent.end_time,
                isAllDay: updatedEvent.is_all_day,
                status: updatedEvent.status,
                category: updatedEvent.category,
                eventColor: updatedEvent.event_color,
                isRecurring: updatedEvent.is_recurring,
                reminderMinutes: updatedEvent.reminder_minutes
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to update event', message: err.message });
    }
});

// Delete calendar event
app.delete('/api/v1/outlook/events/:id', async (req, res) => {
    try {
        const result = await continuumPool.query(`
            DELETE FROM outlook_calendar_events WHERE id = $1 RETURNING id
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({ success: true, deleted: req.params.id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete event', message: err.message });
    }
});

// =============================================================================
// JUBILEE OUTLOOK - EMAIL ROUTES
// =============================================================================

// Get email folders
app.get('/api/v1/outlook/folders', requireUserId, async (req, res) => {
    try {
        const result = await continuumPool.query(`
            SELECT * FROM outlook_email_folders
            WHERE user_id = $1
            ORDER BY display_order, name
        `, [req.userId]);

        res.json({ folders: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch folders', message: err.message });
    }
});

// Create email folder
app.post('/api/v1/outlook/folders', requireUserId, async (req, res) => {
    try {
        const { name, parent_folder_id, folder_type, icon, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const result = await continuumPool.query(`
            INSERT INTO outlook_email_folders (user_id, name, parent_folder_id, folder_type, icon, color)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.userId, name, parent_folder_id, folder_type || 'custom', icon, color]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create folder', message: err.message });
    }
});

// Get email messages
app.get('/api/v1/outlook/messages', requireUserId, async (req, res) => {
    try {
        const { folderId, folder_id, limit = 50, offset = 0, is_read, is_flagged } = req.query;
        const effectiveFolderId = folderId || folder_id;

        let query = `
            SELECT m.*, f.name as folder_name
            FROM outlook_email_messages m
            LEFT JOIN outlook_email_folders f ON m.folder_id = f.id
            WHERE m.user_id = $1
        `;
        const params = [req.userId];
        let paramCount = 1;

        if (effectiveFolderId) {
            params.push(effectiveFolderId);
            query += ` AND m.folder_id = $${++paramCount}`;
        }
        if (is_read !== undefined) {
            params.push(is_read === 'true');
            query += ` AND m.is_read = $${++paramCount}`;
        }
        if (is_flagged !== undefined) {
            params.push(is_flagged === 'true');
            query += ` AND m.is_flagged = $${++paramCount}`;
        }

        params.push(parseInt(limit));
        params.push(parseInt(offset));
        query += ` ORDER BY m.received_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;

        const result = await continuumPool.query(query, params);

        // Get recipients and attachments for each message
        const messages = await Promise.all(result.rows.map(async (msg) => {
            const recipientsResult = await continuumPool.query(`
                SELECT email, name, recipient_type
                FROM outlook_email_recipients
                WHERE message_id = $1
            `, [msg.id]);

            const attachmentsResult = await continuumPool.query(`
                SELECT id, file_name, file_size, mime_type, is_inline
                FROM outlook_email_attachments
                WHERE message_id = $1
            `, [msg.id]);

            return {
                ...msg,
                recipients: recipientsResult.rows,
                attachments: attachmentsResult.rows
            };
        }));

        res.json({ messages });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages', message: err.message });
    }
});

// Get single email message
app.get('/api/v1/outlook/messages/:id', async (req, res) => {
    try {
        const result = await continuumPool.query(`
            SELECT m.*, f.name as folder_name
            FROM outlook_email_messages m
            LEFT JOIN outlook_email_folders f ON m.folder_id = f.id
            WHERE m.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const msg = result.rows[0];

        const recipientsResult = await continuumPool.query(`
            SELECT email, name, recipient_type
            FROM outlook_email_recipients
            WHERE message_id = $1
        `, [msg.id]);

        const attachmentsResult = await continuumPool.query(`
            SELECT id, file_name, file_path, file_size, mime_type, is_inline
            FROM outlook_email_attachments
            WHERE message_id = $1
        `, [msg.id]);

        res.json({
            ...msg,
            recipients: recipientsResult.rows,
            attachments: attachmentsResult.rows
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch message', message: err.message });
    }
});

// Create email message (send/save draft)
app.post('/api/v1/outlook/messages', requireUserId, async (req, res) => {
    try {
        const {
            folder_id, subject, body_text, body_html,
            sender_email, sender_name, is_draft, importance,
            recipients, attachments
        } = req.body;

        const client = await continuumPool.connect();
        try {
            await client.query('BEGIN');

            // Get or create drafts folder if saving as draft
            let folderId = folder_id;
            if (!folderId && is_draft) {
                const folderResult = await client.query(`
                    SELECT id FROM outlook_email_folders
                    WHERE user_id = $1 AND folder_type = 'drafts'
                `, [req.userId]);

                if (folderResult.rows.length === 0) {
                    const newFolder = await client.query(`
                        INSERT INTO outlook_email_folders (user_id, name, folder_type, is_system)
                        VALUES ($1, 'Drafts', 'drafts', true)
                        RETURNING id
                    `, [req.userId]);
                    folderId = newFolder.rows[0].id;
                } else {
                    folderId = folderResult.rows[0].id;
                }
            }

            const result = await client.query(`
                INSERT INTO outlook_email_messages (
                    folder_id, user_id, subject, body_text, body_html,
                    sender_email, sender_name, is_draft, is_read, importance,
                    has_attachments, received_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, NOW())
                RETURNING *
            `, [
                folderId, req.userId, subject, body_text, body_html,
                sender_email, sender_name, is_draft || false, importance || 'normal',
                Array.isArray(attachments) && attachments.length > 0
            ]);

            const newMessage = result.rows[0];

            // Insert recipients
            if (Array.isArray(recipients)) {
                for (const r of recipients) {
                    await client.query(`
                        INSERT INTO outlook_email_recipients (message_id, email, name, recipient_type)
                        VALUES ($1, $2, $3, $4)
                    `, [newMessage.id, r.email, r.name, r.type || 'to']);
                }
            }

            // Insert attachments
            if (Array.isArray(attachments)) {
                for (const att of attachments) {
                    await client.query(`
                        INSERT INTO outlook_email_attachments (message_id, file_name, file_path, file_size, mime_type, is_inline)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [newMessage.id, att.fileName, att.filePath, att.fileSize || 0, att.mimeType, att.isInline || false]);
                }
            }

            await client.query('COMMIT');
            res.status(201).json(newMessage);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to create message', message: err.message });
    }
});

// Update message (mark read, flag, move folder)
app.patch('/api/v1/outlook/messages/:id', async (req, res) => {
    try {
        const { is_read, is_flagged, folder_id } = req.body;

        const updates = [];
        const values = [];
        let paramCount = 0;

        if (is_read !== undefined) {
            values.push(is_read);
            updates.push(`is_read = $${++paramCount}`);
        }
        if (is_flagged !== undefined) {
            values.push(is_flagged);
            updates.push(`is_flagged = $${++paramCount}`);
        }
        if (folder_id) {
            values.push(folder_id);
            updates.push(`folder_id = $${++paramCount}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        values.push(req.params.id);
        const result = await continuumPool.query(`
            UPDATE outlook_email_messages
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${++paramCount}
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update message', message: err.message });
    }
});

// Delete message
app.delete('/api/v1/outlook/messages/:id', async (req, res) => {
    try {
        const result = await continuumPool.query(`
            DELETE FROM outlook_email_messages WHERE id = $1 RETURNING id
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json({ success: true, deleted: req.params.id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete message', message: err.message });
    }
});

// =============================================================================
// JUBILEE OUTLOOK - CONTACTS ROUTES
// =============================================================================

// Get contacts
app.get('/api/v1/outlook/contacts', requireUserId, async (req, res) => {
    try {
        const { search, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT * FROM outlook_contacts
            WHERE user_id = $1
        `;
        const params = [req.userId];
        let paramCount = 1;

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (display_name ILIKE $${++paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
        }

        params.push(parseInt(limit));
        params.push(parseInt(offset));
        query += ` ORDER BY display_name LIMIT $${++paramCount} OFFSET $${++paramCount}`;

        const result = await continuumPool.query(query, params);

        // Get emails and phones for each contact
        const contacts = await Promise.all(result.rows.map(async (contact) => {
            const emailsResult = await continuumPool.query(`
                SELECT email, email_type, is_primary FROM outlook_contact_emails WHERE contact_id = $1
            `, [contact.id]);

            const phonesResult = await continuumPool.query(`
                SELECT phone_number, phone_type, is_primary FROM outlook_contact_phones WHERE contact_id = $1
            `, [contact.id]);

            return {
                ...contact,
                emails: emailsResult.rows,
                phones: phonesResult.rows
            };
        }));

        res.json({ contacts });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch contacts', message: err.message });
    }
});

// Create contact
app.post('/api/v1/outlook/contacts', requireUserId, async (req, res) => {
    try {
        const {
            display_name, first_name, last_name, middle_name, nickname,
            title, suffix, company_name, department, job_title,
            notes, birthday, anniversary, is_favorite,
            emails, phones, addresses
        } = req.body;

        if (!display_name) {
            return res.status(400).json({ error: 'Display name is required' });
        }

        const client = await continuumPool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                INSERT INTO outlook_contacts (
                    user_id, display_name, first_name, last_name, middle_name, nickname,
                    title, suffix, company_name, department, job_title,
                    notes, birthday, anniversary, is_favorite
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            `, [
                req.userId, display_name, first_name, last_name, middle_name, nickname,
                title, suffix, company_name, department, job_title,
                notes, birthday, anniversary, is_favorite || false
            ]);

            const newContact = result.rows[0];

            // Insert emails
            if (Array.isArray(emails)) {
                for (const e of emails) {
                    await client.query(`
                        INSERT INTO outlook_contact_emails (contact_id, email, email_type, is_primary)
                        VALUES ($1, $2, $3, $4)
                    `, [newContact.id, e.email, e.type || 'personal', e.is_primary || false]);
                }
            }

            // Insert phones
            if (Array.isArray(phones)) {
                for (const p of phones) {
                    await client.query(`
                        INSERT INTO outlook_contact_phones (contact_id, phone_number, phone_type, is_primary)
                        VALUES ($1, $2, $3, $4)
                    `, [newContact.id, p.number, p.type || 'mobile', p.is_primary || false]);
                }
            }

            // Insert addresses
            if (Array.isArray(addresses)) {
                for (const a of addresses) {
                    await client.query(`
                        INSERT INTO outlook_contact_addresses (contact_id, address_type, street, city, state, postal_code, country, is_primary)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [newContact.id, a.type || 'home', a.street, a.city, a.state, a.postal_code, a.country, a.is_primary || false]);
                }
            }

            await client.query('COMMIT');
            res.status(201).json(newContact);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to create contact', message: err.message });
    }
});

// Delete contact
app.delete('/api/v1/outlook/contacts/:id', async (req, res) => {
    try {
        const result = await continuumPool.query(`
            DELETE FROM outlook_contacts WHERE id = $1 RETURNING id
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json({ success: true, deleted: req.params.id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete contact', message: err.message });
    }
});

// =============================================================================
// STATIC FILE SERVING (Dashboard UI)
// =============================================================================

app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use((req, res) => {
    // For API routes, return JSON error
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: 'Not Found',
            message: `Endpoint ${req.method} ${req.path} does not exist`,
            available_endpoints: {
                health: 'GET /health',
                status: 'GET /api/v1/status',
                dashboard: 'GET /api/v1/admin/dashboard',
                heartbeat: 'POST /api/v1/admin/heartbeat',
                sessions: 'POST /api/v1/sessions, GET /api/v1/sessions',
                events: 'POST /api/v1/events, POST /api/v1/events/batch',
                conversations: 'GET/POST /api/v1/conversations',
                messages: 'GET/POST /api/v1/conversations/:id/messages',
                content: 'GET/POST /api/v1/content',
                annotations: 'GET/POST /api/v1/annotations',
                progress: 'GET/POST /api/v1/progress',
                analytics: 'POST /api/v1/analytics',
                outlook_calendars: 'GET/POST /api/v1/outlook/calendars',
                outlook_events: 'GET/POST/PUT/DELETE /api/v1/outlook/events',
                outlook_folders: 'GET/POST /api/v1/outlook/folders',
                outlook_messages: 'GET/POST/PATCH/DELETE /api/v1/outlook/messages',
                outlook_contacts: 'GET/POST/DELETE /api/v1/outlook/contacts'
            }
        });
    }
    // For non-API routes, serve the dashboard
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
