/**
 * Codex API Service
 *
 * The identity, SSO, and platform configuration API.
 * This is the authoritative source for user identity across all Jubilee services.
 *
 * RESPONSIBILITIES:
 * - User authentication and authorization
 * - OAuth2/OIDC implementation
 * - Role and permission management
 * - Persona metadata access
 * - Platform configuration and feature flags
 * - Audit logging
 *
 * All other services must use this API for identity verification.
 * No service may duplicate or redefine identity data.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initializePools, closePools, checkAllHealth } from '@jubilee/database';
import * as codex from '@jubilee/database/codex';

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
  const codexHealth = health.find(h => h.database === 'codex');

  return c.json({
    status: codexHealth?.healthy ? 'healthy' : 'unhealthy',
    service: 'codex-api',
    database: codexHealth,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// USER ENDPOINTS
// ============================================================================

// Get user by ID
app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const user = await codex.getUserById(id);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Remove sensitive fields
  const { passwordHash, ...safeUser } = user;
  return c.json({ data: safeUser });
});

// Get user by email
app.get('/api/users/email/:email', async (c) => {
  const email = c.req.param('email');
  const user = await codex.getUserByEmail(email);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const { passwordHash, ...safeUser } = user;
  return c.json({ data: safeUser });
});

// Create user
app.post('/api/users', async (c) => {
  const body = await c.req.json();

  try {
    const user = await codex.createUser(body);
    const { passwordHash, ...safeUser } = user;

    await codex.createAuditLog({
      eventType: 'user.created',
      eventCategory: 'identity',
      userId: user.id,
      outcome: 'success',
      metadata: { email: user.email },
    });

    return c.json({ data: safeUser }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create user' }, 400);
  }
});

// Get user roles
app.get('/api/users/:id/roles', async (c) => {
  const id = c.req.param('id');
  const roles = await codex.getUserRoles(id);
  return c.json({ data: roles });
});

// Get user permissions
app.get('/api/users/:id/permissions', async (c) => {
  const id = c.req.param('id');
  const permissions = await codex.getUserPermissions(id);
  return c.json({ data: permissions });
});

// Check user permission
app.get('/api/users/:id/permissions/:permission', async (c) => {
  const id = c.req.param('id');
  const permission = c.req.param('permission');
  const hasPermission = await codex.userHasPermission(id, permission);
  return c.json({ data: { hasPermission } });
});

// ============================================================================
// ROLE ENDPOINTS
// ============================================================================

app.get('/api/roles', async (c) => {
  const roles = await codex.getRoles();
  return c.json({ data: roles });
});

app.post('/api/users/:id/roles/:roleId', async (c) => {
  const userId = c.req.param('id');
  const roleId = c.req.param('roleId');
  const body = await c.req.json().catch(() => ({}));

  await codex.assignRoleToUser(userId, roleId, body.assignedBy, body.resourceScope);

  await codex.createAuditLog({
    eventType: 'role.assigned',
    eventCategory: 'authorization',
    userId,
    outcome: 'success',
    metadata: { roleId, assignedBy: body.assignedBy },
  });

  return c.json({ success: true });
});

// ============================================================================
// PERSONA ENDPOINTS
// ============================================================================

app.get('/api/personas', async (c) => {
  const categoryId = c.req.query('categoryId');
  const isActive = c.req.query('isActive');
  const isFeatured = c.req.query('isFeatured');
  const limit = parseInt(c.req.query('limit') ?? '100');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const personas = await codex.getPersonas({
    categoryId: categoryId ?? undefined,
    isActive: isActive ? isActive === 'true' : undefined,
    isFeatured: isFeatured ? isFeatured === 'true' : undefined,
    limit,
    offset,
  });

  return c.json({ data: personas });
});

app.get('/api/personas/:id', async (c) => {
  const id = c.req.param('id');
  const persona = await codex.getPersonaById(id);

  if (!persona) {
    return c.json({ error: 'Persona not found' }, 404);
  }

  return c.json({ data: persona });
});

app.get('/api/personas/slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const persona = await codex.getPersonaBySlug(slug);

  if (!persona) {
    return c.json({ error: 'Persona not found' }, 404);
  }

  return c.json({ data: persona });
});

app.post('/api/personas', async (c) => {
  const body = await c.req.json();

  try {
    const persona = await codex.createPersona(body);

    await codex.createAuditLog({
      eventType: 'persona.created',
      eventCategory: 'content',
      resourceType: 'persona',
      resourceId: persona.id,
      outcome: 'success',
      metadata: { slug: persona.slug },
    });

    return c.json({ data: persona }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create persona' }, 400);
  }
});

app.get('/api/persona-categories', async (c) => {
  const categories = await codex.getPersonaCategories();
  return c.json({ data: categories });
});

// ============================================================================
// FEATURE FLAGS
// ============================================================================

app.get('/api/feature-flags', async (c) => {
  const flags = await codex.getFeatureFlags();
  return c.json({ data: flags });
});

app.get('/api/feature-flags/:name', async (c) => {
  const name = c.req.param('name');
  const flag = await codex.getFeatureFlag(name);

  if (!flag) {
    return c.json({ error: 'Feature flag not found' }, 404);
  }

  return c.json({ data: flag });
});

app.get('/api/feature-flags/:name/enabled', async (c) => {
  const name = c.req.param('name');
  const userId = c.req.query('userId');
  const role = c.req.query('role');
  const environment = c.req.query('environment');

  const enabled = await codex.isFeatureEnabled(name, {
    userId: userId ?? undefined,
    role: role ?? undefined,
    environment: environment ?? undefined,
  });

  return c.json({ data: { enabled } });
});

// ============================================================================
// PLATFORM SETTINGS
// ============================================================================

app.get('/api/settings', async (c) => {
  const settings = await codex.getPublicPlatformSettings();
  return c.json({ data: settings });
});

app.get('/api/settings/:key', async (c) => {
  const key = c.req.param('key');
  const value = await codex.getPlatformSetting(key);

  if (value === null) {
    return c.json({ error: 'Setting not found' }, 404);
  }

  return c.json({ data: { key, value } });
});

// ============================================================================
// BIBLE REFERENCES
// ============================================================================

app.get('/api/bible/books', async (c) => {
  const books = await codex.getBibleBooks();
  return c.json({ data: books });
});

app.get('/api/bible/books/:code', async (c) => {
  const code = c.req.param('code');
  const book = await codex.getBibleBookByCode(code);

  if (!book) {
    return c.json({ error: 'Book not found' }, 404);
  }

  return c.json({ data: book });
});

// ============================================================================
// AUDIT LOGS (Admin only)
// ============================================================================

app.get('/api/audit-logs', async (c) => {
  const userId = c.req.query('userId');
  const eventType = c.req.query('eventType');
  const eventCategory = c.req.query('eventCategory');
  const limit = parseInt(c.req.query('limit') ?? '100');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const logs = await codex.getAuditLogs({
    userId: userId ?? undefined,
    eventType: eventType ?? undefined,
    eventCategory: eventCategory ?? undefined,
    limit,
    offset,
  });

  return c.json({ data: logs });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const port = parseInt(process.env.CODEX_API_PORT ?? '4001');

async function start() {
  console.log('Initializing Codex API...');

  try {
    await initializePools();
    console.log('Database pools initialized');

    serve({
      fetch: app.fetch,
      port,
    });

    console.log(`Codex API running on http://localhost:${port}`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /health                    - Health check');
    console.log('  GET  /api/users/:id             - Get user by ID');
    console.log('  POST /api/users                 - Create user');
    console.log('  GET  /api/personas              - List personas');
    console.log('  GET  /api/feature-flags         - List feature flags');
    console.log('  GET  /api/settings              - Get public settings');
    console.log('  GET  /api/bible/books           - List Bible books');
  } catch (error) {
    console.error('Failed to start Codex API:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down Codex API...');
  await closePools();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down Codex API...');
  await closePools();
  process.exit(0);
});

start();
