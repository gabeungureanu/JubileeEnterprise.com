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
import { initializePools, closePools, checkAllHealth } from '@jubilee/database';
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
