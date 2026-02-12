/**
 * Continuum API Service
 *
 * The user data and activity API.
 * This service provides access to user settings, subscriptions,
 * communities, and activity tracking.
 *
 * RESPONSIBILITIES:
 * - User settings and preferences
 * - Session management (beyond OAuth)
 * - Subscription and billing management
 * - Community and discussion board management
 * - User favorites and bookmarks
 * - Domain registration
 * - Safety monitoring and admin alerts
 * - User activity logging
 *
 * This API should be called by websites for user-data operations.
 * User identity must be verified via the Codex API first.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initializePools, closePools, checkAllHealth, getContinuumPool } from '@jubilee/database';
import * as continuum from '@jubilee/database/continuum';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  credentials: true,
}));

// Health check
app.get('/health', async (c) => {
  const health = await checkAllHealth();
  const continuumHealth = health.find(h => h.database === 'continuum');

  return c.json({
    status: continuumHealth?.healthy ? 'healthy' : 'unhealthy',
    service: 'continuum-api',
    database: continuumHealth,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// USER SETTINGS ENDPOINTS
// ============================================================================

// Get user settings
app.get('/api/users/:userId/settings', async (c) => {
  const userId = c.req.param('userId');
  const settings = await continuum.getUserSettings(userId);

  if (!settings) {
    // Return default settings if none exist
    return c.json({
      data: {
        userId,
        theme: 'system',
        fontSize: 'medium',
        emailNotifications: true,
        pushNotifications: true,
        marketingEmails: false,
        uiLanguage: 'en',
        timezone: 'UTC',
        customSettings: {},
      },
    });
  }

  return c.json({ data: settings });
});

// Update user settings
app.put('/api/users/:userId/settings', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json();

  const settings = await continuum.createOrUpdateUserSettings(userId, body);
  return c.json({ data: settings });
});

// ============================================================================
// SESSION ENDPOINTS
// ============================================================================

// Get user sessions
app.get('/api/users/:userId/sessions', async (c) => {
  const userId = c.req.param('userId');
  const sessions = await continuum.getUserSessions(userId);
  return c.json({ data: sessions });
});

// Create session
app.post('/api/users/:userId/sessions', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json();

  const session = await continuum.createUserSession({
    ...body,
    userId,
  });
  return c.json({ data: session }, 201);
});

// Update session activity
app.post('/api/sessions/:sessionId/activity', async (c) => {
  const sessionId = c.req.param('sessionId');
  await continuum.updateSessionActivity(sessionId);
  return c.json({ success: true });
});

// Revoke session
app.delete('/api/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const { reason } = await c.req.json().catch(() => ({}));
  await continuum.revokeSession(sessionId, reason);
  return c.json({ success: true });
});

// Revoke all user sessions
app.delete('/api/users/:userId/sessions', async (c) => {
  const userId = c.req.param('userId');
  const { exceptSessionId } = await c.req.json().catch(() => ({}));
  await continuum.revokeAllUserSessions(userId, exceptSessionId);
  return c.json({ success: true });
});

// ============================================================================
// SUBSCRIPTION ENDPOINTS
// ============================================================================

// Get subscription plans
app.get('/api/subscription-plans', async (c) => {
  const plans = await continuum.getSubscriptionPlans();
  return c.json({ data: plans });
});

// Get subscription plan by slug
app.get('/api/subscription-plans/:slug', async (c) => {
  const slug = c.req.param('slug');
  const plan = await continuum.getSubscriptionPlanBySlug(slug);

  if (!plan) {
    return c.json({ error: 'Plan not found' }, 404);
  }

  return c.json({ data: plan });
});

// Get user subscription
app.get('/api/users/:userId/subscription', async (c) => {
  const userId = c.req.param('userId');
  const subscription = await continuum.getUserSubscription(userId);

  if (!subscription) {
    return c.json({ data: null });
  }

  return c.json({ data: subscription });
});

// Create subscription
app.post('/api/users/:userId/subscription', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json();

  try {
    const subscription = await continuum.createSubscription({
      ...body,
      userId,
    });
    return c.json({ data: subscription }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create subscription' }, 400);
  }
});

// Cancel subscription
app.post('/api/subscriptions/:subscriptionId/cancel', async (c) => {
  const subscriptionId = c.req.param('subscriptionId');
  const { reason, immediate } = await c.req.json().catch(() => ({}));

  await continuum.cancelSubscription(subscriptionId, reason, immediate ?? false);
  return c.json({ success: true });
});

// Get user payment methods
app.get('/api/users/:userId/payment-methods', async (c) => {
  const userId = c.req.param('userId');
  const methods = await continuum.getUserPaymentMethods(userId);
  return c.json({ data: methods });
});

// Get user invoices
app.get('/api/users/:userId/invoices', async (c) => {
  const userId = c.req.param('userId');
  const limit = parseInt(c.req.query('limit') ?? '20');
  const invoices = await continuum.getUserInvoices(userId, limit);
  return c.json({ data: invoices });
});

// ============================================================================
// COMMUNITY ENDPOINTS
// ============================================================================

// List communities
app.get('/api/communities', async (c) => {
  const visibility = c.req.query('visibility');
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const communities = await continuum.getCommunities({
    visibility: visibility ?? undefined,
    limit,
    offset,
  });

  return c.json({ data: communities });
});

// Get community by ID
app.get('/api/communities/:id', async (c) => {
  const id = c.req.param('id');
  const community = await continuum.getCommunityById(id);

  if (!community) {
    return c.json({ error: 'Community not found' }, 404);
  }

  return c.json({ data: community });
});

// Get community by slug
app.get('/api/communities/slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const community = await continuum.getCommunityBySlug(slug);

  if (!community) {
    return c.json({ error: 'Community not found' }, 404);
  }

  return c.json({ data: community });
});

// Create community
app.post('/api/communities', async (c) => {
  const body = await c.req.json();

  try {
    const community = await continuum.createCommunity(body);
    return c.json({ data: community }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create community' }, 400);
  }
});

// Get community members
app.get('/api/communities/:id/members', async (c) => {
  const id = c.req.param('id');
  const members = await continuum.getCommunityMembers(id);
  return c.json({ data: members });
});

// Join community
app.post('/api/communities/:id/join', async (c) => {
  const id = c.req.param('id');
  const { userId } = await c.req.json();

  await continuum.joinCommunity(id, userId);
  return c.json({ success: true });
});

// Leave community
app.post('/api/communities/:id/leave', async (c) => {
  const id = c.req.param('id');
  const { userId } = await c.req.json();

  await continuum.leaveCommunity(id, userId);
  return c.json({ success: true });
});

// ============================================================================
// DISCUSSION BOARD ENDPOINTS
// ============================================================================

// Get community boards
app.get('/api/communities/:communityId/boards', async (c) => {
  const communityId = c.req.param('communityId');
  const boards = await continuum.getCommunityBoards(communityId);
  return c.json({ data: boards });
});

// Get board conversations
app.get('/api/boards/:boardId/conversations', async (c) => {
  const boardId = c.req.param('boardId');
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const conversations = await continuum.getBoardConversations(boardId, { limit, offset });
  return c.json({ data: conversations });
});

// Get board messages
app.get('/api/board-conversations/:conversationId/messages', async (c) => {
  const conversationId = c.req.param('conversationId');
  const messages = await continuum.getBoardMessages(conversationId);
  return c.json({ data: messages });
});

// ============================================================================
// FAVORITES ENDPOINTS
// ============================================================================

// Get user favorites
app.get('/api/users/:userId/favorites', async (c) => {
  const userId = c.req.param('userId');
  const type = c.req.query('type');

  const favorites = await continuum.getUserFavorites(userId, type ?? undefined);
  return c.json({ data: favorites });
});

// Add favorite
app.post('/api/users/:userId/favorites', async (c) => {
  const userId = c.req.param('userId');
  const { type, id } = await c.req.json();

  const favorite = await continuum.addFavorite(userId, type, id);
  return c.json({ data: favorite }, 201);
});

// Remove favorite
app.delete('/api/users/:userId/favorites/:type/:favoriteId', async (c) => {
  const userId = c.req.param('userId');
  const type = c.req.param('type');
  const favoriteId = c.req.param('favoriteId');

  await continuum.removeFavorite(userId, type, favoriteId);
  return c.json({ success: true });
});

// ============================================================================
// DOMAIN ENDPOINTS
// ============================================================================

// Get available TLDs
app.get('/api/domains/tlds', async (c) => {
  const tlds = await continuum.getJubileeTlds();
  return c.json({ data: tlds });
});

// Get user domains
app.get('/api/users/:userId/domains', async (c) => {
  const userId = c.req.param('userId');
  const domains = await continuum.getUserDomains(userId);
  return c.json({ data: domains });
});

// Check domain availability
app.get('/api/domains/check', async (c) => {
  const name = c.req.query('name');
  const tld = c.req.query('tld');

  if (!name || !tld) {
    return c.json({ error: 'name and tld are required' }, 400);
  }

  const available = await continuum.checkDomainAvailability(name, tld);
  return c.json({ data: { name, tld, available } });
});

// Register domain
app.post('/api/domains', async (c) => {
  const body = await c.req.json();

  try {
    const domain = await continuum.registerDomain(body);
    return c.json({ data: domain }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to register domain' }, 400);
  }
});

// ============================================================================
// SAFETY & MODERATION ENDPOINTS (Admin only)
// ============================================================================

// Get safety flags
app.get('/api/admin/safety-flags', async (c) => {
  const userId = c.req.query('userId');
  const status = c.req.query('status');
  const severity = c.req.query('severity');
  const limit = parseInt(c.req.query('limit') ?? '100');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const flags = await continuum.getSafetyFlags({
    userId: userId ?? undefined,
    status: status ?? undefined,
    severity: severity ?? undefined,
    limit,
    offset,
  });

  return c.json({ data: flags });
});

// Get admin alerts
app.get('/api/admin/alerts', async (c) => {
  const status = c.req.query('status');
  const severity = c.req.query('severity');
  const limit = parseInt(c.req.query('limit') ?? '50');

  const alerts = await continuum.getAdminAlerts({
    status: status ?? undefined,
    severity: severity ?? undefined,
    limit,
  });

  return c.json({ data: alerts });
});

// ============================================================================
// ACTIVITY ENDPOINTS
// ============================================================================

// Log user activity
app.post('/api/activity', async (c) => {
  const body = await c.req.json();

  await continuum.logUserActivity(body);
  return c.json({ success: true });
});

// Get user activity
app.get('/api/users/:userId/activity', async (c) => {
  const userId = c.req.param('userId');
  const activityType = c.req.query('type');
  const limit = parseInt(c.req.query('limit') ?? '100');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const activity = await continuum.getUserActivity(userId, {
    activityType: activityType ?? undefined,
    limit,
    offset,
  });

  return c.json({ data: activity });
});

// ============================================================================
// OUTLOOK CALENDAR EVENT ENDPOINTS
// ============================================================================

// Helper: map DB row to camelCase event response
function mapEventRow(event: any, calendarName?: string) {
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
    calendarName: calendarName || event.calendar_name || 'My Calendar',
    isRecurring: event.is_recurring,
    reminderMinutes: event.reminder_minutes,
    isPrivate: event.is_private,
    isInPerson: event.is_in_person,
  };
}

// Helper: fetch attendees, attachments, images for an event
async function fetchEventRelations(pool: any, eventId: string) {
  const [attendeesResult, attachmentsResult, imagesResult] = await Promise.all([
    pool.query('SELECT attendee_email, attendee_name, response_status, is_required FROM outlook_event_attendees WHERE event_id = $1', [eventId]),
    pool.query('SELECT id, file_name, file_path, file_size, mime_type, url, created_at as added_date FROM outlook_event_attachments WHERE event_id = $1', [eventId]),
    pool.query('SELECT id, file_name, file_path, file_size, mime_type, url, thumbnail_url, created_at as added_date FROM outlook_event_images WHERE event_id = $1', [eventId]),
  ]);
  return {
    attendees: attendeesResult.rows.map((a: any) => a.attendee_email),
    attachments: attachmentsResult.rows.map((a: any) => ({ id: a.id, fileName: a.file_name, filePath: a.file_path, fileSize: a.file_size, url: a.url, addedDate: a.added_date })),
    images: imagesResult.rows.map((img: any) => ({ id: img.id, fileName: img.file_name, filePath: img.file_path, fileSize: img.file_size, mimeType: img.mime_type, url: img.url, thumbnailUrl: img.thumbnail_url, addedDate: img.added_date })),
  };
}

// GET /api/v1/outlook/events - Get calendar events
app.get('/api/v1/outlook/events', async (c) => {
  try {
    const pool = getContinuumPool();
    const userId = c.req.query('userId') || c.req.query('user_id');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const calendarId = c.req.query('calendarId');

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    let query = `SELECT e.*, c.name as calendar_name FROM outlook_calendar_events e LEFT JOIN outlook_calendars c ON e.calendar_id = c.id WHERE e.user_id = $1`;
    const params: any[] = [userId];
    let paramCount = 1;

    if (startDate) { params.push(startDate); query += ` AND e.start_time >= $${++paramCount}`; }
    if (endDate) { params.push(endDate); query += ` AND e.end_time <= $${++paramCount}`; }
    if (calendarId) { params.push(calendarId); query += ` AND e.calendar_id = $${++paramCount}`; }
    query += ' ORDER BY e.start_time';

    const result = await pool.query(query, params);

    const events = await Promise.all(result.rows.map(async (event: any) => {
      const relations = await fetchEventRelations(pool, event.id);
      return { ...mapEventRow(event), ...relations };
    }));

    return c.json(events);
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch events', message: err.message }, 500);
  }
});

// GET /api/v1/outlook/events/:id - Get single event
app.get('/api/v1/outlook/events/:id', async (c) => {
  try {
    const pool = getContinuumPool();
    const id = c.req.param('id');

    const result = await pool.query(
      `SELECT e.*, c.name as calendar_name FROM outlook_calendar_events e LEFT JOIN outlook_calendars c ON e.calendar_id = c.id WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Event not found' }, 404);
    }

    const event = result.rows[0];
    const relations = await fetchEventRelations(pool, event.id);
    return c.json({ ...mapEventRow(event), ...relations });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch event', message: err.message }, 500);
  }
});

// POST /api/v1/outlook/events - Create calendar event
app.post('/api/v1/outlook/events', async (c) => {
  try {
    const pool = getContinuumPool();
    const body = await c.req.json();

    const userId = body.userId || body.user_id;
    const startTime = body.startTime || body.start_time;
    const endTime = body.endTime || body.end_time;
    const calendarId = body.calendarId || body.calendar_id;
    const isAllDay = body.isAllDay ?? body.is_all_day ?? false;
    const eventColor = body.eventColor || body.event_color || '#5B9BD5';
    const isRecurring = body.isRecurring ?? body.is_recurring ?? false;
    const reminderMinutes = body.reminderMinutes ?? body.reminder_minutes ?? 15;
    const isPrivate = body.isPrivate ?? body.is_private ?? false;
    const isInPerson = body.isInPerson ?? body.is_in_person ?? true;

    if (!userId || !body.subject || !startTime || !endTime) {
      return c.json({ error: 'userId, subject, startTime, and endTime are required' }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get or create default calendar
      let calendarIdToUse = calendarId;
      if (!calendarIdToUse) {
        const calResult = await client.query(
          'SELECT id FROM outlook_calendars WHERE user_id = $1 AND is_default = true', [userId]
        );
        if (calResult.rows.length === 0) {
          const newCal = await client.query(
            `INSERT INTO outlook_calendars (user_id, name, is_default) VALUES ($1, 'My Calendar', true) RETURNING id`, [userId]
          );
          calendarIdToUse = newCal.rows[0].id;
        } else {
          calendarIdToUse = calResult.rows[0].id;
        }
      }

      // Insert event
      const eventResult = await client.query(`
        INSERT INTO outlook_calendar_events (
          calendar_id, user_id, subject, location, description,
          start_time, end_time, is_all_day, status, category,
          event_color, is_recurring, reminder_minutes, is_private, is_in_person
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        calendarIdToUse, userId, body.subject, body.location || '', body.description || '',
        startTime, endTime, isAllDay, body.status || 'free', body.category || '',
        eventColor, isRecurring, reminderMinutes, isPrivate, isInPerson
      ]);

      const newEvent = eventResult.rows[0];

      // Insert attendees
      if (Array.isArray(body.attendees)) {
        for (const attendee of body.attendees) {
          const email = typeof attendee === 'string' ? attendee : attendee.email;
          const name = typeof attendee === 'string' ? null : attendee.name;
          await client.query(
            'INSERT INTO outlook_event_attendees (event_id, attendee_email, attendee_name) VALUES ($1, $2, $3)',
            [newEvent.id, email, name]
          );
        }
      }

      // Insert attachments
      if (Array.isArray(body.attachments)) {
        for (const att of body.attachments) {
          await client.query(
            'INSERT INTO outlook_event_attachments (event_id, file_name, file_path, file_size, mime_type, url) VALUES ($1, $2, $3, $4, $5, $6)',
            [newEvent.id, att.fileName || att.file_name, att.filePath || att.file_path, att.fileSize || att.file_size || 0, att.mimeType || att.mime_type, att.url]
          );
        }
      }

      // Insert images
      if (Array.isArray(body.images)) {
        for (const img of body.images) {
          await client.query(
            'INSERT INTO outlook_event_images (event_id, file_name, file_path, file_size, mime_type, url, thumbnail_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [newEvent.id, img.fileName || img.file_name, img.filePath || img.file_path, img.fileSize || img.file_size || 0, img.mimeType || img.mime_type || 'image/jpeg', img.url, img.thumbnailUrl || img.thumbnail_url]
          );
        }
      }

      await client.query('COMMIT');
      return c.json(mapEventRow(newEvent), 201);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return c.json({ error: 'Failed to create event', message: err.message }, 500);
  }
});

// PUT /api/v1/outlook/events/:id - Update calendar event
app.put('/api/v1/outlook/events/:id', async (c) => {
  try {
    const pool = getContinuumPool();
    const id = c.req.param('id');
    const body = await c.req.json();

    const startTime = body.startTime || body.start_time;
    const endTime = body.endTime || body.end_time;
    const isAllDay = body.isAllDay ?? body.is_all_day;
    const eventColor = body.eventColor || body.event_color;
    const isRecurring = body.isRecurring ?? body.is_recurring;
    const reminderMinutes = body.reminderMinutes ?? body.reminder_minutes;
    const isPrivate = body.isPrivate ?? body.is_private;
    const isInPerson = body.isInPerson ?? body.is_in_person;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        UPDATE outlook_calendar_events SET
          subject = COALESCE($1, subject), location = COALESCE($2, location),
          description = COALESCE($3, description), start_time = COALESCE($4, start_time),
          end_time = COALESCE($5, end_time), is_all_day = COALESCE($6, is_all_day),
          status = COALESCE($7, status), category = COALESCE($8, category),
          event_color = COALESCE($9, event_color), is_recurring = COALESCE($10, is_recurring),
          reminder_minutes = COALESCE($11, reminder_minutes), is_private = COALESCE($12, is_private),
          is_in_person = COALESCE($13, is_in_person), updated_at = NOW()
        WHERE id = $14 RETURNING *
      `, [
        body.subject, body.location, body.description, startTime, endTime,
        isAllDay, body.status, body.category, eventColor, isRecurring,
        reminderMinutes, isPrivate, isInPerson, id
      ]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return c.json({ error: 'Event not found' }, 404);
      }

      // Update attendees if provided
      if (Array.isArray(body.attendees)) {
        await client.query('DELETE FROM outlook_event_attendees WHERE event_id = $1', [id]);
        for (const attendee of body.attendees) {
          const email = typeof attendee === 'string' ? attendee : attendee.email;
          const name = typeof attendee === 'string' ? null : attendee.name;
          await client.query('INSERT INTO outlook_event_attendees (event_id, attendee_email, attendee_name) VALUES ($1, $2, $3)', [id, email, name]);
        }
      }

      // Update attachments if provided
      if (Array.isArray(body.attachments)) {
        await client.query('DELETE FROM outlook_event_attachments WHERE event_id = $1', [id]);
        for (const att of body.attachments) {
          await client.query('INSERT INTO outlook_event_attachments (event_id, file_name, file_path, file_size, mime_type, url) VALUES ($1, $2, $3, $4, $5, $6)', [id, att.fileName || att.file_name, att.filePath || att.file_path, att.fileSize || att.file_size || 0, att.mimeType || att.mime_type, att.url]);
        }
      }

      // Update images if provided
      if (Array.isArray(body.images)) {
        await client.query('DELETE FROM outlook_event_images WHERE event_id = $1', [id]);
        for (const img of body.images) {
          await client.query('INSERT INTO outlook_event_images (event_id, file_name, file_path, file_size, mime_type, url, thumbnail_url) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, img.fileName || img.file_name, img.filePath || img.file_path, img.fileSize || img.file_size || 0, img.mimeType || img.mime_type || 'image/jpeg', img.url, img.thumbnailUrl || img.thumbnail_url]);
        }
      }

      await client.query('COMMIT');
      return c.json(mapEventRow(result.rows[0]));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return c.json({ error: 'Failed to update event', message: err.message }, 500);
  }
});

// DELETE /api/v1/outlook/events/:id - Delete calendar event
app.delete('/api/v1/outlook/events/:id', async (c) => {
  try {
    const pool = getContinuumPool();
    const id = c.req.param('id');

    const result = await pool.query('DELETE FROM outlook_calendar_events WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return c.json({ error: 'Event not found' }, 404);
    }

    return c.json({ success: true, deleted: id });
  } catch (err: any) {
    return c.json({ error: 'Failed to delete event', message: err.message }, 500);
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const port = parseInt(process.env.CONTINUUM_API_PORT ?? '4003');

async function start() {
  console.log('Initializing Continuum API...');

  try {
    await initializePools();
    console.log('Database pools initialized');

    serve({
      fetch: app.fetch,
      port,
    });

    console.log(`Continuum API running on http://localhost:${port}`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /health                          - Health check');
    console.log('  GET  /api/users/:id/settings          - Get user settings');
    console.log('  GET  /api/subscription-plans          - List subscription plans');
    console.log('  GET  /api/communities                 - List communities');
    console.log('  GET  /api/users/:id/favorites         - Get user favorites');
    console.log('  GET  /api/domains/tlds                - Get available TLDs');
    console.log('  POST /api/activity                    - Log user activity');
    console.log('  GET  /api/v1/outlook/events           - Get calendar events');
    console.log('  POST /api/v1/outlook/events           - Create calendar event');
    console.log('  PUT  /api/v1/outlook/events/:id       - Update calendar event');
    console.log('  DELETE /api/v1/outlook/events/:id     - Delete calendar event');
  } catch (error) {
    console.error('Failed to start Continuum API:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down Continuum API...');
  await closePools();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down Continuum API...');
  await closePools();
  process.exit(0);
});

start();
