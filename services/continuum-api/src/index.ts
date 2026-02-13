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
import { ImapFlow } from 'imapflow';
import * as nodemailer from 'nodemailer';
import { createHash, randomUUID } from 'crypto';

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
// EMAIL PROVIDER DETECTION
// ============================================================================

interface ProviderConfig {
  type: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  isAppPassword: boolean;
  helpText: string;
}

const KNOWN_PROVIDERS: Record<string, ProviderConfig> = {
  'gmail.com': {
    type: 'google', displayName: 'Gmail',
    imapHost: 'imap.gmail.com', imapPort: 993,
    smtpHost: 'smtp.gmail.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to myaccount.google.com/apppasswords\n2. Sign in to your Google account\n3. Select "Mail" and "Windows Computer"\n4. Click "Generate" and use the 16-character password',
  },
  'googlemail.com': {
    type: 'google', displayName: 'Gmail',
    imapHost: 'imap.gmail.com', imapPort: 993,
    smtpHost: 'smtp.gmail.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to myaccount.google.com/apppasswords\n2. Sign in to your Google account\n3. Select "Mail" and "Windows Computer"\n4. Click "Generate" and use the 16-character password',
  },
  'outlook.com': {
    type: 'microsoft', displayName: 'Microsoft 365',
    imapHost: 'outlook.office365.com', imapPort: 993,
    smtpHost: 'smtp.office365.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to account.microsoft.com/security\n2. Turn on Two-step verification\n3. Click "App passwords"\n4. Create a new app password for JubileeOutlook',
  },
  'hotmail.com': {
    type: 'microsoft', displayName: 'Microsoft 365',
    imapHost: 'outlook.office365.com', imapPort: 993,
    smtpHost: 'smtp.office365.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to account.microsoft.com/security\n2. Turn on Two-step verification\n3. Click "App passwords"\n4. Create a new app password for JubileeOutlook',
  },
  'live.com': {
    type: 'microsoft', displayName: 'Microsoft 365',
    imapHost: 'outlook.office365.com', imapPort: 993,
    smtpHost: 'smtp.office365.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to account.microsoft.com/security\n2. Turn on Two-step verification\n3. Click "App passwords"\n4. Create a new app password for JubileeOutlook',
  },
  'yahoo.com': {
    type: 'yahoo', displayName: 'Yahoo',
    imapHost: 'imap.mail.yahoo.com', imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to login.yahoo.com/account/security\n2. Under "Other ways to sign in", click "Generate app password"\n3. Select "Other app" and enter "JubileeOutlook"\n4. Use the generated password',
  },
  'icloud.com': {
    type: 'apple', displayName: 'iCloud',
    imapHost: 'imap.mail.me.com', imapPort: 993,
    smtpHost: 'smtp.mail.me.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to appleid.apple.com\n2. Sign in and go to Security\n3. Click "Generate Password" under App-Specific Passwords\n4. Enter a label like "JubileeOutlook"\n5. Use the generated password',
  },
  'me.com': {
    type: 'apple', displayName: 'iCloud',
    imapHost: 'imap.mail.me.com', imapPort: 993,
    smtpHost: 'smtp.mail.me.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to appleid.apple.com\n2. Sign in and go to Security\n3. Click "Generate Password" under App-Specific Passwords\n4. Enter a label like "JubileeOutlook"\n5. Use the generated password',
  },
  'mac.com': {
    type: 'apple', displayName: 'iCloud',
    imapHost: 'imap.mail.me.com', imapPort: 993,
    smtpHost: 'smtp.mail.me.com', smtpPort: 587,
    isAppPassword: true,
    helpText: 'To generate an App Password:\n1. Go to appleid.apple.com\n2. Sign in and go to Security\n3. Click "Generate Password" under App-Specific Passwords\n4. Enter a label like "JubileeOutlook"\n5. Use the generated password',
  },
};

function detectProvider(email: string): ProviderConfig {
  const domain = email.split('@').pop()?.toLowerCase() || '';
  if (KNOWN_PROVIDERS[domain]) return KNOWN_PROVIDERS[domain];

  // Check for Google Workspace or Microsoft custom domains
  if (domain.includes('google')) return KNOWN_PROVIDERS['gmail.com'];
  if (domain.includes('microsoft') || domain.includes('office365')) return KNOWN_PROVIDERS['outlook.com'];

  // Fallback: generic IMAP
  return {
    type: 'generic', displayName: 'IMAP/POP',
    imapHost: `imap.${domain}`, imapPort: 993,
    smtpHost: `smtp.${domain}`, smtpPort: 587,
    isAppPassword: false,
    helpText: 'Enter the password for your email account.\nIf your account has two-factor authentication, you may need to use an app-specific password.',
  };
}

// ============================================================================
// EMAIL SYNC ENDPOINTS
// ============================================================================

// POST /api/v1/outlook/accounts/detect - Detect email provider
app.post('/api/v1/outlook/accounts/detect', async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ error: 'Email is required' }, 400);

    const provider = detectProvider(email);
    return c.json({
      success: true,
      provider: {
        type: provider.type,
        displayName: provider.displayName,
        isAppPassword: provider.isAppPassword,
        helpText: provider.helpText,
        imapHost: provider.imapHost,
        imapPort: provider.imapPort,
        smtpHost: provider.smtpHost,
        smtpPort: provider.smtpPort,
      },
    });
  } catch (err: any) {
    return c.json({ error: 'Provider detection failed', message: err.message }, 500);
  }
});

// POST /api/v1/outlook/accounts/connect - Test IMAP connection and save account
app.post('/api/v1/outlook/accounts/connect', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, userId } = body;
    if (!email || !password || !userId) {
      return c.json({ error: 'Email, password, and userId are required' }, 400);
    }

    const provider = detectProvider(email);

    // Test IMAP connection
    const client = new ImapFlow({
      host: provider.imapHost,
      port: provider.imapPort,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    try {
      await client.connect();
    } catch (connErr: any) {
      const msg = connErr.message || '';
      if (msg.includes('Invalid credentials') || msg.includes('AUTHENTICATIONFAILED') || msg.includes('LOGIN failed')) {
        return c.json({ error: 'Invalid email or password. If your account has two-factor authentication, please use an App Password.' }, 401);
      }
      if (msg.includes('Application-specific password required') || msg.includes('less secure')) {
        return c.json({ error: 'This account requires an App Password. Please generate one from your account security settings.' }, 401);
      }
      return c.json({ error: `Connection failed: ${msg}` }, 502);
    }

    // Discover folders
    const folders: Array<{ name: string; path: string; specialUse: string | null; delimiter: string }> = [];
    const mailboxes = await client.list();
    for (const mbox of mailboxes) {
      folders.push({
        name: mbox.name,
        path: mbox.path,
        specialUse: (mbox as any).specialUse || null,
        delimiter: mbox.delimiter,
      });
    }

    await client.logout();

    // Save account to database
    const pool = getContinuumPool();
    const dbClient = await pool.connect();

    try {
      await dbClient.query('BEGIN');

      // Simple encryption (base64 for now - in production use proper encryption)
      const encryptedPassword = Buffer.from(password).toString('base64');

      // Upsert the account
      const accountResult = await dbClient.query(
        `INSERT INTO outlook_email_accounts (user_id, email_address, display_name, provider_type, auth_method, imap_host, imap_port, imap_use_ssl, smtp_host, smtp_port, smtp_use_ssl, encrypted_password, connection_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'connected')
         ON CONFLICT (user_id, email_address) DO UPDATE SET
           encrypted_password = $12, connection_status = 'connected', error_message = NULL, updated_at = NOW()
         RETURNING id`,
        [userId, email, email.split('@')[0], provider.type, provider.isAppPassword ? 'app_password' : 'password',
         provider.imapHost, provider.imapPort, true, provider.smtpHost, provider.smtpPort, true, encryptedPassword]
      );
      const accountId = accountResult.rows[0].id;

      // Map specialUse to folder types
      const folderTypeMap: Record<string, { type: string; icon: string; order: number }> = {
        '\\Inbox': { type: 'inbox', icon: 'inbox', order: 1 },
        '\\Sent': { type: 'sent', icon: 'send', order: 2 },
        '\\Drafts': { type: 'drafts', icon: 'draft', order: 3 },
        '\\Trash': { type: 'trash', icon: 'delete', order: 4 },
        '\\Junk': { type: 'junk', icon: 'report', order: 5 },
        '\\Archive': { type: 'archive', icon: 'archive', order: 6 },
      };

      // Create/update folders
      const createdFolders: Array<{ id: string; name: string; type: string; path: string }> = [];
      for (const folder of folders) {
        const mapped = folder.specialUse ? folderTypeMap[folder.specialUse] : null;
        const folderType = mapped?.type || 'custom';
        const icon = mapped?.icon || 'folder';
        const displayOrder = mapped?.order || 99;
        const isSystem = !!mapped;

        const folderResult = await dbClient.query(
          `INSERT INTO outlook_email_folders (user_id, account_id, name, folder_type, display_order, is_system, icon, external_folder_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (account_id, external_folder_id) DO UPDATE SET
             name = EXCLUDED.name, folder_type = EXCLUDED.folder_type,
             display_order = EXCLUDED.display_order, icon = EXCLUDED.icon
           RETURNING id`,
          [userId, accountId, folder.name, folderType, displayOrder, isSystem, icon, folder.path]
        );

        if (folderResult.rows.length > 0) {
          createdFolders.push({ id: folderResult.rows[0].id, name: folder.name, type: folderType, path: folder.path });
        }
      }

      await dbClient.query('COMMIT');

      return c.json({
        success: true,
        account: { id: accountId, email, provider: provider.type, displayName: provider.displayName },
        folders: createdFolders,
        message: `Connected to ${provider.displayName}. Found ${createdFolders.length} folders.`,
      });
    } catch (dbErr) {
      await dbClient.query('ROLLBACK');
      throw dbErr;
    } finally {
      dbClient.release();
    }
  } catch (err: any) {
    if (err.status) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Failed to connect account', message: err.message }, 500);
  }
});

// POST /api/v1/outlook/accounts/:id/sync - Sync email messages from IMAP
app.post('/api/v1/outlook/accounts/:id/sync', async (c) => {
  try {
    const accountId = c.req.param('id');
    const pool = getContinuumPool();

    // Get account details
    const accountResult = await pool.query(
      'SELECT * FROM outlook_email_accounts WHERE id = $1', [accountId]
    );
    if (accountResult.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404);
    }
    const account = accountResult.rows[0];
    const password = Buffer.from(account.encrypted_password, 'base64').toString('utf-8');

    // Get folders for this account
    const foldersResult = await pool.query(
      'SELECT * FROM outlook_email_folders WHERE account_id = $1 AND sync_enabled = true ORDER BY display_order',
      [accountId]
    );

    // Connect to IMAP
    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_use_ssl,
      auth: { user: account.email_address, pass: password },
      logger: false,
    });

    await client.connect();

    let totalSynced = 0;
    const syncResults: Array<{ folder: string; synced: number }> = [];

    for (const folder of foldersResult.rows) {
      try {
        const lock = await client.getMailboxLock(folder.external_folder_id);
        try {
          // Fetch most recent 100 messages
          const messages: Array<any> = [];
          const fetchOptions = { uid: true, envelope: true, bodyStructure: true, flags: true, size: true };

          // Get message count
          const status = client.mailbox;
          if (!status || status.exists === 0) continue;

          // Fetch last 100 messages by sequence number
          const startSeq = Math.max(1, (status.exists || 0) - 99);
          for await (const msg of client.fetch(`${startSeq}:*`, fetchOptions)) {
            messages.push(msg);
          }

          // Store messages in database
          const dbClient = await pool.connect();
          try {
            await dbClient.query('BEGIN');
            let folderSynced = 0;

            for (const msg of messages) {
              const envelope = msg.envelope;
              if (!envelope) continue;

              const senderEmail = envelope.from?.[0]?.address || '';
              const senderName = envelope.from?.[0]?.name || senderEmail.split('@')[0] || '';
              const subject = envelope.subject || '(No Subject)';
              const receivedAt = envelope.date || new Date();
              const messageIdHeader = envelope.messageId || '';
              const isRead = msg.flags?.has('\\Seen') || false;
              const isFlagged = msg.flags?.has('\\Flagged') || false;

              // Check if message already exists (by internet_message_id)
              const existsResult = await dbClient.query(
                'SELECT id FROM outlook_email_messages WHERE folder_id = $1 AND internet_message_id = $2',
                [folder.id, messageIdHeader]
              );
              if (existsResult.rows.length > 0) {
                // Update flags only
                await dbClient.query(
                  'UPDATE outlook_email_messages SET is_read = $1, is_flagged = $2 WHERE id = $3',
                  [isRead, isFlagged, existsResult.rows[0].id]
                );
                continue;
              }

              // Build body preview from subject
              const bodyPreview = subject.substring(0, 200);

              // Insert the message
              const insertResult = await dbClient.query(
                `INSERT INTO outlook_email_messages (folder_id, user_id, subject, body_preview, sender_email, sender_name, is_read, is_flagged, has_attachments, received_at, internet_message_id, external_message_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (folder_id, internet_message_id) DO NOTHING
                 RETURNING id`,
                [folder.id, account.user_id, subject, bodyPreview, senderEmail, senderName, isRead, isFlagged,
                 !!(msg.bodyStructure?.childNodes?.length), receivedAt, messageIdHeader, String(msg.uid)]
              );
              if (insertResult.rows.length === 0) continue; // Already exists (conflict)
              const messageId = insertResult.rows[0].id;

              // Insert recipients
              const recipients = [
                ...(envelope.to || []).map((r: any) => ({ ...r, type: 'to' })),
                ...(envelope.cc || []).map((r: any) => ({ ...r, type: 'cc' })),
                ...(envelope.bcc || []).map((r: any) => ({ ...r, type: 'bcc' })),
              ];

              for (const recipient of recipients) {
                if (recipient.address) {
                  await dbClient.query(
                    'INSERT INTO outlook_email_recipients (message_id, recipient_type, email, name) VALUES ($1, $2, $3, $4)',
                    [messageId, recipient.type, recipient.address, recipient.name || '']
                  );
                }
              }

              folderSynced++;
            }

            // Update folder counts
            const countResult = await dbClient.query(
              'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_read = false) as unread FROM outlook_email_messages WHERE folder_id = $1',
              [folder.id]
            );
            await dbClient.query(
              'UPDATE outlook_email_folders SET total_count = $1, unread_count = $2 WHERE id = $3',
              [parseInt(countResult.rows[0].total), parseInt(countResult.rows[0].unread), folder.id]
            );

            await dbClient.query('COMMIT');
            totalSynced += folderSynced;
            syncResults.push({ folder: folder.name, synced: folderSynced });
          } catch (dbErr) {
            await dbClient.query('ROLLBACK');
            throw dbErr;
          } finally {
            dbClient.release();
          }
        } finally {
          lock.release();
        }
      } catch (folderErr: any) {
        syncResults.push({ folder: folder.name, synced: 0 });
        console.error(`[Sync] Error syncing folder ${folder.name}: ${folderErr.message}`);
      }
    }

    await client.logout();

    // Update last sync time
    await pool.query(
      'UPDATE outlook_email_accounts SET last_sync_at = NOW(), connection_status = $1 WHERE id = $2',
      ['connected', accountId]
    );

    return c.json({
      success: true,
      totalSynced,
      folders: syncResults,
      message: `Synced ${totalSynced} new messages across ${syncResults.length} folders.`,
    });
  } catch (err: any) {
    return c.json({ error: 'Sync failed', message: err.message }, 500);
  }
});

// GET /api/v1/outlook/accounts - List connected email accounts
app.get('/api/v1/outlook/accounts', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ error: 'userId is required' }, 400);

    const pool = getContinuumPool();
    const result = await pool.query(
      `SELECT id, email_address, display_name, provider_type, connection_status, last_sync_at, created_at
       FROM outlook_email_accounts WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    );

    return c.json({ success: true, accounts: result.rows });
  } catch (err: any) {
    return c.json({ error: 'Failed to list accounts', message: err.message }, 500);
  }
});

// DELETE /api/v1/outlook/accounts/:id - Disconnect email account
app.delete('/api/v1/outlook/accounts/:id', async (c) => {
  try {
    const accountId = c.req.param('id');
    const pool = getContinuumPool();

    const result = await pool.query(
      'DELETE FROM outlook_email_accounts WHERE id = $1 RETURNING id, email_address', [accountId]
    );
    if (result.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json({ success: true, deleted: result.rows[0].email_address });
  } catch (err: any) {
    return c.json({ error: 'Failed to delete account', message: err.message }, 500);
  }
});

// ============================================================================
// MAIL DATA ENDPOINTS (Folders, Messages)
// ============================================================================

// GET /api/v1/outlook/folders - List folders for a user
app.get('/api/v1/outlook/folders', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    const pool = getContinuumPool();
    const result = await pool.query(
      `SELECT f.id, f.name, f.folder_type, f.unread_count, f.total_count,
              f.parent_folder_id, f.icon, f.display_order, f.is_system
       FROM outlook_email_folders f
       JOIN outlook_email_accounts a ON f.account_id = a.id
       WHERE a.user_id = $1
       ORDER BY f.display_order ASC, f.name ASC`,
      [userId]
    );

    // Build nested folder structure
    const foldersMap = new Map<string, any>();
    const rootFolders: any[] = [];

    for (const row of result.rows) {
      const folder = {
        id: row.id,
        name: row.name,
        folder_type: row.folder_type || 'custom',
        unread_count: row.unread_count || 0,
        total_count: row.total_count || 0,
        parent_folder_id: row.parent_folder_id || null,
        icon: row.icon || '',
        is_account_root: false,
        wwbw_email_address: '',
        is_expanded: true,
        subfolders: [] as any[],
      };
      foldersMap.set(row.id, folder);
    }

    for (const folder of foldersMap.values()) {
      if (folder.parent_folder_id && foldersMap.has(folder.parent_folder_id)) {
        foldersMap.get(folder.parent_folder_id)!.subfolders.push(folder);
      } else {
        rootFolders.push(folder);
      }
    }

    return c.json({ success: true, folders: rootFolders });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch folders', message: err.message }, 500);
  }
});

// POST /api/v1/outlook/folders - Create a custom folder
app.post('/api/v1/outlook/folders', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, name, parentFolderId } = body;

    if (!userId || !name) {
      return c.json({ error: 'userId and name are required' }, 400);
    }

    const pool = getContinuumPool();

    // Find the user's account
    const accountResult = await pool.query(
      'SELECT id FROM outlook_email_accounts WHERE user_id = $1 LIMIT 1', [userId]
    );
    if (accountResult.rows.length === 0) {
      return c.json({ error: 'No email account found' }, 404);
    }
    const accountId = accountResult.rows[0].id;

    // Get max display_order for ordering
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM outlook_email_folders WHERE account_id = $1',
      [accountId]
    );
    const displayOrder = orderResult.rows[0].next_order;

    const folderId = randomUUID();

    await pool.query(
      `INSERT INTO outlook_email_folders (id, account_id, name, folder_type, external_folder_id, display_order, is_system, parent_folder_id, icon)
       VALUES ($1, $2, $3, 'custom', $4, $5, false, $6, 'folder')`,
      [folderId, accountId, name, `custom-${folderId}`, displayOrder, parentFolderId || null]
    );

    return c.json({ success: true, folderId, name });
  } catch (err: any) {
    return c.json({ error: 'Failed to create folder', message: err.message }, 500);
  }
});

// PATCH /api/v1/outlook/folders/:id - Rename a folder (custom folders only)
app.patch('/api/v1/outlook/folders/:id', async (c) => {
  try {
    const folderId = c.req.param('id');
    const body = await c.req.json();
    const { name } = body;

    if (!name) {
      return c.json({ error: 'name is required' }, 400);
    }

    const pool = getContinuumPool();

    // Check if folder exists and is not a system folder
    const folderResult = await pool.query(
      'SELECT id, is_system FROM outlook_email_folders WHERE id = $1', [folderId]
    );
    if (folderResult.rows.length === 0) {
      return c.json({ error: 'Folder not found' }, 404);
    }
    if (folderResult.rows[0].is_system) {
      return c.json({ error: 'Cannot rename system folders' }, 403);
    }

    await pool.query(
      'UPDATE outlook_email_folders SET name = $1, updated_at = NOW() WHERE id = $2',
      [name, folderId]
    );

    return c.json({ success: true, folderId, name });
  } catch (err: any) {
    return c.json({ error: 'Failed to rename folder', message: err.message }, 500);
  }
});

// DELETE /api/v1/outlook/folders/:id - Delete a custom folder (moves messages to Trash)
app.delete('/api/v1/outlook/folders/:id', async (c) => {
  try {
    const folderId = c.req.param('id');
    const pool = getContinuumPool();

    // Check if folder exists and is not a system folder
    const folderResult = await pool.query(
      'SELECT id, is_system, account_id FROM outlook_email_folders WHERE id = $1', [folderId]
    );
    if (folderResult.rows.length === 0) {
      return c.json({ error: 'Folder not found' }, 404);
    }
    if (folderResult.rows[0].is_system) {
      return c.json({ error: 'Cannot delete system folders' }, 403);
    }

    const accountId = folderResult.rows[0].account_id;

    // Find trash folder to move messages there
    const trashResult = await pool.query(
      `SELECT id FROM outlook_email_folders WHERE account_id = $1 AND folder_type = 'trash' LIMIT 1`,
      [accountId]
    );

    if (trashResult.rows.length > 0) {
      // Move all messages from this folder to trash
      await pool.query(
        'UPDATE outlook_email_messages SET folder_id = $1 WHERE folder_id = $2',
        [trashResult.rows[0].id, folderId]
      );
    }

    // Delete the folder
    await pool.query('DELETE FROM outlook_email_folders WHERE id = $1', [folderId]);

    return c.json({ success: true, deleted: folderId });
  } catch (err: any) {
    return c.json({ error: 'Failed to delete folder', message: err.message }, 500);
  }
});

// GET /api/v1/outlook/folders/:folderId/messages - List messages in a folder
app.get('/api/v1/outlook/folders/:folderId/messages', async (c) => {
  try {
    const folderId = c.req.param('folderId');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    const pool = getContinuumPool();

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM outlook_email_messages WHERE folder_id = $1',
      [folderId]
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get messages with recipients
    const messagesResult = await pool.query(
      `SELECT m.id, m.subject, m.sender_name, m.sender_email,
              m.body_preview, m.body_text, m.body_html,
              m.is_read, m.is_flagged, m.has_attachments, m.is_draft, m.is_sent,
              m.importance, m.received_at, m.sent_at,
              m.folder_id, m.conversation_id
       FROM outlook_email_messages m
       WHERE m.folder_id = $1
       ORDER BY m.received_at DESC
       LIMIT $2 OFFSET $3`,
      [folderId, pageSize, offset]
    );

    // Get recipients for all messages
    const messageIds = messagesResult.rows.map((m: any) => m.id);
    let recipientsMap = new Map<string, any[]>();

    if (messageIds.length > 0) {
      const recipientsResult = await pool.query(
        `SELECT message_id, recipient_type as type, email, name
         FROM outlook_email_recipients
         WHERE message_id = ANY($1)`,
        [messageIds]
      );
      for (const r of recipientsResult.rows) {
        if (!recipientsMap.has(r.message_id)) {
          recipientsMap.set(r.message_id, []);
        }
        recipientsMap.get(r.message_id)!.push({
          type: r.type,
          email: r.email,
          name: r.name || '',
        });
      }
    }

    const messages = messagesResult.rows.map((m: any) => ({
      id: m.id,
      subject: m.subject || '(No subject)',
      sender_name: m.sender_name || '',
      sender_email: m.sender_email || '',
      body_preview: m.body_preview || '',
      body_text: m.body_text || '',
      body_html: m.body_html || '',
      is_read: m.is_read,
      is_flagged: m.is_flagged,
      has_attachments: m.has_attachments,
      importance: m.importance || 'normal',
      received_at: m.received_at,
      sent_at: m.sent_at,
      folder_id: m.folder_id,
      conversation_id: m.conversation_id,
      recipients: recipientsMap.get(m.id) || [],
      attachments: [],
    }));

    return c.json({
      success: true,
      messages,
      total_count: totalCount,
      page,
      page_size: pageSize,
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch messages', message: err.message }, 500);
  }
});

// GET /api/v1/outlook/messages/search - Full-text search across messages
app.get('/api/v1/outlook/messages/search', async (c) => {
  try {
    const userId = c.req.query('userId');
    const q = c.req.query('q');
    const folderId = c.req.query('folderId');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 100);
    if (!userId || !q) return c.json({ error: 'userId and q are required' }, 400);

    const pool = getContinuumPool();
    const offset = (page - 1) * pageSize;
    // Build tsquery from space-separated words
    const tsQuery = q.trim().split(/\s+/).filter(Boolean).map((w: string) => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean).join(' & ');
    if (!tsQuery) return c.json({ success: true, messages: [], total_count: 0, page, page_size: pageSize });

    let whereClause = 'm.user_id = $1 AND m.search_vector @@ to_tsquery(\'english\', $2)';
    const params: any[] = [userId, tsQuery];
    let paramCount = 2;

    if (folderId) {
      params.push(folderId);
      whereClause += ` AND m.folder_id = $${++paramCount}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM outlook_email_messages m WHERE ${whereClause}`, params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    const messagesResult = await pool.query(
      `SELECT m.id, m.subject, m.sender_name, m.sender_email, m.body_preview, m.body_text, m.body_html,
              m.is_read, m.is_flagged, m.has_attachments, m.importance, m.received_at, m.sent_at,
              m.folder_id, m.conversation_id
       FROM outlook_email_messages m WHERE ${whereClause}
       ORDER BY m.received_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`,
      [...params, pageSize, offset]
    );

    // Batch-fetch recipients
    const messageIds = messagesResult.rows.map((r: any) => r.id);
    let recipientMap: Record<string, any[]> = {};
    if (messageIds.length > 0) {
      const recipResult = await pool.query(
        'SELECT message_id, recipient_type as type, email, name FROM outlook_email_recipients WHERE message_id = ANY($1)',
        [messageIds]
      );
      for (const r of recipResult.rows) {
        if (!recipientMap[r.message_id]) recipientMap[r.message_id] = [];
        recipientMap[r.message_id].push({ type: r.type, email: r.email, name: r.name });
      }
    }

    const messages = messagesResult.rows.map((m: any) => ({
      ...m,
      recipients: recipientMap[m.id] || [],
      attachments: [],
    }));

    return c.json({ success: true, messages, total_count: totalCount, page, page_size: pageSize });
  } catch (err: any) {
    return c.json({ error: 'Failed to search messages', message: err.message }, 500);
  }
});

// GET /api/v1/outlook/messages/:id - Get single message with full details
// Lazy-loads body from IMAP if not stored in database
app.get('/api/v1/outlook/messages/:id', async (c) => {
  try {
    const messageId = c.req.param('id');
    const pool = getContinuumPool();

    const msgResult = await pool.query(
      `SELECT m.id, m.subject, m.sender_name, m.sender_email,
              m.body_preview, m.body_text, m.body_html,
              m.is_read, m.is_flagged, m.has_attachments, m.is_draft, m.is_sent,
              m.importance, m.received_at, m.sent_at,
              m.folder_id, m.conversation_id, m.external_message_id,
              f.external_folder_id, a.imap_host, a.imap_port, a.email_address, a.encrypted_password
       FROM outlook_email_messages m
       JOIN outlook_email_folders f ON m.folder_id = f.id
       JOIN outlook_email_accounts a ON f.account_id = a.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (msgResult.rows.length === 0) {
      return c.json({ error: 'Message not found' }, 404);
    }

    let m = msgResult.rows[0];

    // Lazy-load body from IMAP if not cached in DB
    if (!m.body_text && !m.body_html && m.imap_host) {
      try {
        const imapPassword = Buffer.from(m.encrypted_password || '', 'base64').toString('utf-8');
        const client = new ImapFlow({
          host: m.imap_host,
          port: m.imap_port || 993,
          secure: true,
          auth: { user: m.email_address, pass: imapPassword },
          logger: false,
        });

        await client.connect();
        const lock = await client.getMailboxLock(m.external_folder_id || 'INBOX');

        try {
          // Search for message by Message-ID header
          const msgIdHeader = m.conversation_id || m.subject;
          let targetUid: number | null = null;

          // Use IMAP SEARCH to find the message by its Internet Message-ID
          const internetMsgId = await pool.query(
            'SELECT internet_message_id FROM outlook_email_messages WHERE id = $1', [messageId]
          );
          const headerMsgId = internetMsgId.rows[0]?.internet_message_id;

          if (headerMsgId) {
            // Strip angle brackets for IMAP search
            const cleanMsgId = headerMsgId.replace(/^<|>$/g, '');
            const uids = await client.search({ header: { 'message-id': cleanMsgId } });
            if (uids.length > 0) {
              targetUid = uids[0];
            }
          }

          if (targetUid) {
            for await (const msg of client.fetch(String(targetUid), { source: true, bodyStructure: true, uid: true })) {
              if (msg.source) {
                const raw = msg.source.toString();
                let bodyText = '';
                let bodyHtml = '';

                // Parse MIME parts from raw source
                const parts = raw.split(/\r?\n--/);
                for (const part of parts) {
                  const headerEnd = part.indexOf('\r\n\r\n');
                  const headerEndLf = part.indexOf('\n\n');
                  const splitPos = headerEnd > -1 ? headerEnd : headerEndLf;
                  if (splitPos === -1) continue;

                  const partHeader = part.substring(0, splitPos);
                  let partBody = part.substring(splitPos).replace(/^\r?\n\r?\n/, '').trim();

                  // Remove trailing boundary markers
                  partBody = partBody.replace(/\r?\n--[^\r\n]+--\s*$/, '').trim();

                  const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(partHeader);
                  const isQP = /Content-Transfer-Encoding:\s*quoted-printable/i.test(partHeader);

                  if (isBase64 && partBody) {
                    try { partBody = Buffer.from(partBody.replace(/\s/g, ''), 'base64').toString('utf-8'); } catch {}
                  } else if (isQP && partBody) {
                    partBody = partBody.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g,
                      (_: any, hex: string) => String.fromCharCode(parseInt(hex, 16)));
                  }

                  if (/Content-Type:\s*text\/plain/i.test(partHeader) && !bodyText) {
                    bodyText = partBody;
                  } else if (/Content-Type:\s*text\/html/i.test(partHeader) && !bodyHtml) {
                    bodyHtml = partBody;
                  }
                }

                // Fallback: non-multipart email
                if (!bodyText && !bodyHtml) {
                  const simpleBody = raw.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim();
                  if (/Content-Type:\s*text\/html/i.test(raw)) {
                    bodyHtml = simpleBody;
                  } else {
                    bodyText = simpleBody;
                  }
                }

                // Cache in database for future requests
                if (bodyText || bodyHtml) {
                  const preview = (bodyText || bodyHtml.replace(/<[^>]*>/g, '')).substring(0, 200);
                  await pool.query(
                    'UPDATE outlook_email_messages SET body_text = $1, body_html = $2, body_preview = $3 WHERE id = $4',
                    [bodyText || '', bodyHtml || '', preview, messageId]
                  );
                  m.body_text = bodyText;
                  m.body_html = bodyHtml;
                  m.body_preview = preview;
                }

                // Extract and store attachment metadata from bodyStructure
                if (msg.bodyStructure) {
                  const extractAttachments = (node: any): Array<{ fileName: string; fileSize: number; mimeType: string; isInline: boolean; part: string }> => {
                    const atts: Array<{ fileName: string; fileSize: number; mimeType: string; isInline: boolean; part: string }> = [];
                    const fileName = node.dispositionParameters?.filename || node.parameters?.name || '';
                    const isAttachment = node.disposition === 'attachment' || (fileName && node.disposition !== 'inline');
                    const isInline = node.disposition === 'inline' && !!fileName;
                    if ((isAttachment || isInline) && fileName) {
                      atts.push({
                        fileName,
                        fileSize: node.size || 0,
                        mimeType: node.type || 'application/octet-stream',
                        isInline,
                        part: node.part || '',
                      });
                    }
                    if (node.childNodes) {
                      for (const child of node.childNodes) {
                        atts.push(...extractAttachments(child));
                      }
                    }
                    return atts;
                  };

                  const attachments = extractAttachments(msg.bodyStructure);
                  if (attachments.length > 0) {
                    // Clear existing attachment metadata for this message to avoid duplicates
                    await pool.query('DELETE FROM outlook_email_attachments WHERE message_id = $1', [messageId]);
                    for (const att of attachments) {
                      await pool.query(
                        `INSERT INTO outlook_email_attachments (message_id, file_name, file_path, file_size, mime_type, is_inline)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [messageId, att.fileName, att.part, att.fileSize, att.mimeType, att.isInline]
                      );
                    }
                    // Update has_attachments flag
                    await pool.query(
                      'UPDATE outlook_email_messages SET has_attachments = true WHERE id = $1',
                      [messageId]
                    );
                    m.has_attachments = true;
                  }
                }
              }
            }
          }
        } finally {
          lock.release();
        }

        await client.logout();
      } catch (imapErr: any) {
        console.error('IMAP body fetch failed:', imapErr.message);
      }
    }

    // Get recipients
    const recipientsResult = await pool.query(
      `SELECT recipient_type as type, email, name
       FROM outlook_email_recipients WHERE message_id = $1`,
      [messageId]
    );

    // Get attachments
    const attachResult = await pool.query(
      `SELECT id, file_name as "fileName", file_path as "filePath",
              file_size as "fileSize", mime_type as "mimeType", is_inline as "isInline"
       FROM outlook_email_attachments WHERE message_id = $1`,
      [messageId]
    );

    const message = {
      id: m.id,
      subject: m.subject || '(No subject)',
      sender_name: m.sender_name || '',
      sender_email: m.sender_email || '',
      body_preview: m.body_preview || '',
      body_text: m.body_text || '',
      body_html: m.body_html || '',
      is_read: m.is_read,
      is_flagged: m.is_flagged,
      has_attachments: m.has_attachments,
      importance: m.importance || 'normal',
      received_at: m.received_at,
      sent_at: m.sent_at,
      folder_id: m.folder_id,
      conversation_id: m.conversation_id,
      recipients: recipientsResult.rows.map((r: any) => ({
        type: r.type,
        email: r.email,
        name: r.name || '',
      })),
      attachments: attachResult.rows,
    };

    return c.json({ success: true, message });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch message', message: err.message }, 500);
  }
});

// GET /api/v1/outlook/messages/:messageId/attachments/:attachmentId/download - Download attachment
app.get('/api/v1/outlook/messages/:messageId/attachments/:attachmentId/download', async (c) => {
  try {
    const messageId = c.req.param('messageId');
    const attachmentId = c.req.param('attachmentId');
    const pool = getContinuumPool();

    // Get attachment metadata + IMAP connection info
    const attResult = await pool.query(
      `SELECT a.id, a.file_name, a.file_path, a.file_size, a.mime_type, a.is_inline,
              m.external_message_id, m.internet_message_id, m.folder_id,
              f.external_folder_id, acc.imap_host, acc.imap_port, acc.email_address, acc.encrypted_password
       FROM outlook_email_attachments a
       JOIN outlook_email_messages m ON a.message_id = m.id
       JOIN outlook_email_folders f ON m.folder_id = f.id
       JOIN outlook_email_accounts acc ON f.account_id = acc.id
       WHERE a.id = $1 AND a.message_id = $2`,
      [attachmentId, messageId]
    );

    if (attResult.rows.length === 0) {
      return c.json({ error: 'Attachment not found' }, 404);
    }

    const att = attResult.rows[0];

    // Connect to IMAP to fetch the attachment content
    const imapPassword = Buffer.from(att.encrypted_password || '', 'base64').toString('utf-8');
    const client = new ImapFlow({
      host: att.imap_host,
      port: att.imap_port || 993,
      secure: true,
      auth: { user: att.email_address, pass: imapPassword },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock(att.external_folder_id || 'INBOX');

    try {
      // Find the message UID by Internet Message-ID
      const headerMsgId = att.internet_message_id;
      let targetUid: number | null = null;

      if (headerMsgId) {
        const cleanMsgId = headerMsgId.replace(/^<|>$/g, '');
        const uids = await client.search({ header: { 'message-id': cleanMsgId } });
        if (uids.length > 0) targetUid = uids[0];
      }

      if (!targetUid) {
        return c.json({ error: 'Could not find message on mail server' }, 404);
      }

      // Fetch bodyStructure to find the attachment MIME part
      let attachmentPart: string | null = null;
      for await (const msg of client.fetch(String(targetUid), { bodyStructure: true, uid: true })) {
        const findPart = (node: any, path: string = ''): string | null => {
          const currentPath = node.part || path;
          const nodeName = node.dispositionParameters?.filename || node.parameters?.name || '';
          if (nodeName === att.file_name) {
            return currentPath;
          }
          if (node.childNodes) {
            for (let i = 0; i < node.childNodes.length; i++) {
              const childPath = currentPath ? `${currentPath}.${i + 1}` : `${i + 1}`;
              const found = findPart(node.childNodes[i], childPath);
              if (found) return found;
            }
          }
          return null;
        };
        attachmentPart = findPart(msg.bodyStructure);
      }

      if (!attachmentPart) {
        return c.json({ error: 'Attachment part not found in message structure' }, 404);
      }

      // Download the specific MIME part
      const { content } = await client.download(String(targetUid), attachmentPart, { uid: true });
      const chunks: Buffer[] = [];
      for await (const chunk of content) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
      }
      const buffer = Buffer.concat(chunks);

      c.header('Content-Type', att.mime_type || 'application/octet-stream');
      c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(att.file_name)}"`);
      c.header('Content-Length', String(buffer.length));
      return c.body(buffer);
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err: any) {
    console.error('Attachment download error:', err.message);
    return c.json({ error: 'Failed to download attachment', message: err.message }, 500);
  }
});

// PATCH /api/v1/outlook/messages/:id - Update message (read, flag, move)
app.patch('/api/v1/outlook/messages/:id', async (c) => {
  try {
    const messageId = c.req.param('id');
    const body = await c.req.json();
    const pool = getContinuumPool();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (typeof body.is_read === 'boolean') {
      updates.push(`is_read = $${paramIndex++}`);
      values.push(body.is_read);
    }
    if (typeof body.is_flagged === 'boolean') {
      updates.push(`is_flagged = $${paramIndex++}`);
      values.push(body.is_flagged);
    }
    if (body.folder_id) {
      updates.push(`folder_id = $${paramIndex++}`);
      values.push(body.folder_id);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    values.push(messageId);
    await pool.query(
      `UPDATE outlook_email_messages SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Failed to update message', message: err.message }, 500);
  }
});

// DELETE /api/v1/outlook/messages/:id - Delete a message permanently
app.delete('/api/v1/outlook/messages/:id', async (c) => {
  try {
    const messageId = c.req.param('id');
    const pool = getContinuumPool();
    const result = await pool.query(
      'DELETE FROM outlook_email_messages WHERE id = $1 RETURNING id, folder_id', [messageId]
    );
    if (result.rows.length === 0) {
      return c.json({ error: 'Message not found' }, 404);
    }
    return c.json({ success: true, deleted: messageId });
  } catch (err: any) {
    return c.json({ error: 'Failed to delete message', message: err.message }, 500);
  }
});

// POST /api/v1/outlook/messages/send - Send an email via SMTP
app.post('/api/v1/outlook/messages/send', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, sender_email, subject, body_html, body_text, recipients, importance, attachments } = body;

    if (!userId || !sender_email || !recipients?.length) {
      return c.json({ error: 'userId, sender_email, and recipients are required' }, 400);
    }

    const pool = getContinuumPool();

    // Lookup SMTP credentials from the account
    const accountResult = await pool.query(
      `SELECT id, email_address, smtp_host, smtp_port, smtp_use_ssl, encrypted_password, display_name
       FROM outlook_email_accounts WHERE user_id = $1 AND email_address = $2 LIMIT 1`,
      [userId, sender_email]
    );

    if (accountResult.rows.length === 0) {
      return c.json({ error: 'No email account found for this sender' }, 404);
    }

    const account = accountResult.rows[0];
    const smtpPassword = Buffer.from(account.encrypted_password || '', 'base64').toString('utf-8');

    // Create nodemailer transport
    const transport = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port || 587,
      secure: account.smtp_port === 465,
      auth: {
        user: account.email_address,
        pass: smtpPassword,
      },
    });

    // Build recipient lists
    const toAddresses = recipients.filter((r: any) => r.type === 'to').map((r: any) => r.name ? `"${r.name}" <${r.email}>` : r.email);
    const ccAddresses = recipients.filter((r: any) => r.type === 'cc').map((r: any) => r.name ? `"${r.name}" <${r.email}>` : r.email);
    const bccAddresses = recipients.filter((r: any) => r.type === 'bcc').map((r: any) => r.name ? `"${r.name}" <${r.email}>` : r.email);

    const mailOptions: any = {
      from: account.display_name ? `"${account.display_name}" <${account.email_address}>` : account.email_address,
      to: toAddresses.join(', '),
      subject: subject || '(No Subject)',
      text: body_text || '',
      html: body_html || undefined,
      priority: importance === 'high' ? 'high' : importance === 'low' ? 'low' : 'normal',
    };

    if (ccAddresses.length) mailOptions.cc = ccAddresses.join(', ');
    if (bccAddresses.length) mailOptions.bcc = bccAddresses.join(', ');

    // Handle attachments (base64-encoded from frontend)
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType || 'application/octet-stream',
      }));
    }

    // Send the email
    const info = await transport.sendMail(mailOptions);

    // Save a copy in the Sent folder in the database
    const sentFolder = await pool.query(
      `SELECT id FROM outlook_email_folders WHERE account_id = $1 AND folder_type = 'sent' LIMIT 1`,
      [account.id]
    );

    if (sentFolder.rows.length > 0) {
      const sentFolderId = sentFolder.rows[0].id;
      const messageId = randomUUID();

      await pool.query(
        `INSERT INTO outlook_email_messages
         (id, folder_id, user_id, subject, sender_name, sender_email, body_html, body_text, body_preview,
          is_read, is_flagged, has_attachments, is_draft, is_sent, importance, internet_message_id, received_at, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false, $10, false, true, $11, $12, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          messageId, sentFolderId, userId, subject || '(No Subject)',
          account.display_name || sender_email, sender_email,
          body_html || null, body_text || null,
          (body_text || '').substring(0, 200),
          !!(attachments && attachments.length > 0),
          importance || 'normal', info.messageId || messageId,
        ]
      );

      // Insert recipients for the sent copy
      for (const r of recipients) {
        await pool.query(
          `INSERT INTO outlook_email_recipients (message_id, email, name, recipient_type)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [messageId, r.email, r.name || '', r.type || 'to']
        );
      }

      // Update folder counts
      await pool.query(
        `UPDATE outlook_email_folders SET total_count = (
           SELECT COUNT(*) FROM outlook_email_messages WHERE folder_id = $1
         ) WHERE id = $1`,
        [sentFolderId]
      );
    }

    return c.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    console.error('Send email error:', err.message);
    return c.json({ error: 'Failed to send email', message: err.message }, 500);
  }
});

// POST /api/v1/outlook/messages/draft - Save or update a draft
app.post('/api/v1/outlook/messages/draft', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, id, sender_email, subject, body_html, body_text, recipients } = body;

    if (!userId || !sender_email) {
      return c.json({ error: 'userId and sender_email are required' }, 400);
    }

    const pool = getContinuumPool();

    // Find the account and drafts folder
    const accountResult = await pool.query(
      `SELECT a.id as account_id, a.display_name, f.id as drafts_folder_id
       FROM outlook_email_accounts a
       JOIN outlook_email_folders f ON f.account_id = a.id AND f.folder_type = 'drafts'
       WHERE a.user_id = $1 AND a.email_address = $2 LIMIT 1`,
      [userId, sender_email]
    );

    if (accountResult.rows.length === 0) {
      return c.json({ error: 'No email account or drafts folder found' }, 404);
    }

    const { drafts_folder_id, display_name } = accountResult.rows[0];
    let draftId = id;

    if (draftId) {
      // Update existing draft
      await pool.query(
        `UPDATE outlook_email_messages SET
           subject = $1, body_html = $2, body_text = $3,
           body_preview = $4, updated_at = NOW()
         WHERE id = $5 AND is_draft = true`,
        [
          subject || '(No Subject)', body_html || null, body_text || null,
          (body_text || '').substring(0, 200), draftId,
        ]
      );

      // Replace recipients
      await pool.query('DELETE FROM outlook_email_recipients WHERE message_id = $1', [draftId]);
    } else {
      // Create new draft
      draftId = randomUUID();

      await pool.query(
        `INSERT INTO outlook_email_messages
         (id, folder_id, user_id, subject, sender_name, sender_email, body_html, body_text, body_preview,
          is_read, is_flagged, has_attachments, is_draft, is_sent, importance, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false, false, true, false, 'normal', NOW())`,
        [
          draftId, drafts_folder_id, userId, subject || '(No Subject)',
          display_name || sender_email, sender_email,
          body_html || null, body_text || null,
          (body_text || '').substring(0, 200),
        ]
      );
    }

    // Insert recipients
    if (recipients?.length) {
      for (const r of recipients) {
        await pool.query(
          `INSERT INTO outlook_email_recipients (message_id, email, name, recipient_type)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [draftId, r.email, r.name || '', r.type || 'to']
        );
      }
    }

    // Update drafts folder count
    await pool.query(
      `UPDATE outlook_email_folders SET total_count = (
         SELECT COUNT(*) FROM outlook_email_messages WHERE folder_id = $1
       ) WHERE id = $1`,
      [drafts_folder_id]
    );

    return c.json({ success: true, draftId });
  } catch (err: any) {
    console.error('Save draft error:', err.message);
    return c.json({ error: 'Failed to save draft', message: err.message }, 500);
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
    console.log('  POST /api/v1/outlook/accounts/detect  - Detect email provider');
    console.log('  POST /api/v1/outlook/accounts/connect - Connect email account');
    console.log('  POST /api/v1/outlook/accounts/:id/sync - Sync email messages');
    console.log('  GET  /api/v1/outlook/accounts         - List email accounts');
    console.log('  DELETE /api/v1/outlook/accounts/:id   - Disconnect account');
    console.log('  GET  /api/v1/outlook/folders          - List email folders');
    console.log('  POST /api/v1/outlook/folders          - Create custom folder');
    console.log('  PATCH /api/v1/outlook/folders/:id     - Rename folder');
    console.log('  DELETE /api/v1/outlook/folders/:id    - Delete folder');
    console.log('  GET  /api/v1/outlook/folders/:id/messages - Get folder messages');
    console.log('  GET  /api/v1/outlook/messages/search  - Search messages');
    console.log('  GET  /api/v1/outlook/messages/:id     - Get single message');
    console.log('  PATCH /api/v1/outlook/messages/:id    - Update message');
    console.log('  DELETE /api/v1/outlook/messages/:id   - Delete message');
    console.log('  POST /api/v1/outlook/messages/send   - Send email via SMTP');
    console.log('  POST /api/v1/outlook/messages/draft  - Save/update draft');
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
