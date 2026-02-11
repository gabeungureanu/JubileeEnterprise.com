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
// AUTH ENDPOINTS
// Routes under /api/auth/ for JubileeOutlook authentication
// ============================================================================

// OAuth user registration - find or create user by email after OAuth login
app.post('/api/auth/oauth-register', async (c) => {
  const body = await c.req.json();
  const { email, displayName, provider, providerId, avatarUrl } = body;

  if (!email) {
    return c.json({ success: false, error: 'Email is required' }, 400);
  }

  try {
    // Try to find existing user by email
    let user = await codex.getUserByEmail(email);
    let isNewUser = false;

    if (!user) {
      // Create new user for this OAuth account
      user = await codex.createUser({
        email,
        displayName: displayName || email.split('@')[0],
        role: 'member',
        authProvider: provider || 'oauth',
        authProviderId: providerId,
        avatarUrl,
      });
      isNewUser = true;

      await codex.createAuditLog({
        eventType: 'user.oauth_registered',
        eventCategory: 'identity',
        userId: user.id,
        outcome: 'success',
        metadata: { email, provider, isNewUser: true },
      });
    } else {
      await codex.createAuditLog({
        eventType: 'user.oauth_login',
        eventCategory: 'identity',
        userId: user.id,
        outcome: 'success',
        metadata: { email, provider, isNewUser: false },
      });
    }

    const { passwordHash, ...safeUser } = user;

    return c.json({
      success: true,
      isNewUser,
      user: {
        id: safeUser.id,
        email: safeUser.email,
        displayName: safeUser.display_name ?? safeUser.displayName ?? email.split('@')[0],
        role: safeUser.role,
        avatarUrl: safeUser.avatar_url ?? safeUser.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Error in oauth-register:', error);
    return c.json({ success: false, error: 'Failed to register OAuth user' }, 500);
  }
});

// Get current user profile (session validation)
app.get('/api/auth/me', async (c) => {
  const userId = c.req.header('X-User-Id');

  if (!userId) {
    return c.json({ success: false, error: 'Not authenticated' }, 401);
  }

  try {
    const user = await codex.getUserById(userId);
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const { passwordHash, ...safeUser } = user;
    return c.json({
      success: true,
      user: {
        id: safeUser.id,
        email: safeUser.email,
        displayName: safeUser.display_name ?? safeUser.displayName,
        role: safeUser.role,
        avatarUrl: safeUser.avatar_url ?? safeUser.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return c.json({ success: false, error: 'Failed to get user profile' }, 500);
  }
});

// ============================================================================
// CONTACTS ENDPOINTS (JubileeOutlook People Module)
// Routes under /api/v1/contacts for WPF client compatibility
// ============================================================================

/**
 * Converts a snake_case database row to camelCase for API response
 */
function toCamelCase(row: any): any {
  if (!row) return null;
  const result: any = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// Get contacts for a user (paginated)
app.get('/api/v1/contacts', async (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id');

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  const page = parseInt(c.req.query('page') ?? '1');
  const pageSize = parseInt(c.req.query('pageSize') ?? '100');

  try {
    const result = await codex.getContacts(userId, page, pageSize);
    return c.json({
      success: true,
      contacts: result.contacts.map(toCamelCase),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return c.json({ success: false, error: 'Failed to fetch contacts' }, 500);
  }
});

// Search contacts
app.get('/api/v1/contacts/search', async (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id');
  const query = c.req.query('q');

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  if (!query) {
    return c.json({ success: false, error: 'Search query (q) is required' }, 400);
  }

  const page = parseInt(c.req.query('page') ?? '1');
  const pageSize = parseInt(c.req.query('pageSize') ?? '50');

  try {
    const result = await codex.searchContacts(userId, query, page, pageSize);
    return c.json({
      success: true,
      contacts: result.contacts.map(toCamelCase),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    console.error('Error searching contacts:', error);
    return c.json({ success: false, error: 'Failed to search contacts' }, 500);
  }
});

// Get a single contact by ID
app.get('/api/v1/contacts/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const contact = await codex.getContactById(id);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }
    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error fetching contact:', error);
    return c.json({ success: false, error: 'Failed to fetch contact' }, 500);
  }
});

// Create a new contact
app.post('/api/v1/contacts', async (c) => {
  const body = await c.req.json();
  const userId = body.userId || c.req.header('X-User-Id');

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  if (!body.displayName) {
    return c.json({ success: false, error: 'displayName is required' }, 400);
  }

  try {
    const contact = await codex.createContact({
      userId,
      displayName: body.displayName,
      firstName: body.firstName,
      lastName: body.lastName,
      title: body.title,
      middleName: body.middleName,
      suffix: body.suffix,
      nickname: body.nickname,
      emailAddresses: body.emailAddresses,
      phoneNumbers: body.phoneNumbers,
      mobilePhone: body.mobilePhone,
      company: body.company,
      jobTitle: body.jobTitle,
      department: body.department,
      office: body.office,
      address: body.address,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
      notes: body.notes,
      photoUrl: body.photoUrl,
      birthday: body.birthday,
      anniversary: body.anniversary,
      spouse: body.spouse,
      website: body.website,
      isFavorite: body.isFavorite,
      category: body.category,
    });

    await codex.createAuditLog({
      eventType: 'contact.created',
      eventCategory: 'contacts',
      userId,
      resourceType: 'contact',
      resourceId: contact.id,
      outcome: 'success',
      metadata: { displayName: body.displayName },
    });

    return c.json({ success: true, contact: toCamelCase(contact) }, 201);
  } catch (error) {
    console.error('Error creating contact:', error);
    return c.json({ success: false, error: 'Failed to create contact' }, 500);
  }
});

// Update a contact
app.put('/api/v1/contacts/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  try {
    const contact = await codex.updateContact(id, {
      displayName: body.displayName,
      firstName: body.firstName,
      lastName: body.lastName,
      title: body.title,
      middleName: body.middleName,
      suffix: body.suffix,
      nickname: body.nickname,
      emailAddresses: body.emailAddresses,
      phoneNumbers: body.phoneNumbers,
      mobilePhone: body.mobilePhone,
      company: body.company,
      jobTitle: body.jobTitle,
      department: body.department,
      office: body.office,
      address: body.address,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
      notes: body.notes,
      photoUrl: body.photoUrl,
      birthday: body.birthday,
      anniversary: body.anniversary,
      spouse: body.spouse,
      website: body.website,
      isFavorite: body.isFavorite,
      category: body.category,
    });

    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    await codex.createAuditLog({
      eventType: 'contact.updated',
      eventCategory: 'contacts',
      userId: contact.user_id,
      resourceType: 'contact',
      resourceId: id,
      outcome: 'success',
    });

    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error updating contact:', error);
    return c.json({ success: false, error: 'Failed to update contact' }, 500);
  }
});

// Delete a contact (hard delete)
app.delete('/api/v1/contacts/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await codex.getContactById(id);
    const deleted = await codex.deleteContact(id);

    if (!deleted) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    await codex.createAuditLog({
      eventType: 'contact.deleted',
      eventCategory: 'contacts',
      userId: existing?.user_id,
      resourceType: 'contact',
      resourceId: id,
      outcome: 'success',
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return c.json({ success: false, error: 'Failed to delete contact' }, 500);
  }
});

// Toggle favorite status
app.patch('/api/v1/contacts/:id/favorite', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  try {
    const contact = await codex.toggleContactFavorite(id, body.isFavorite ?? false);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }
    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return c.json({ success: false, error: 'Failed to toggle favorite' }, 500);
  }
});

// Soft delete a contact
app.patch('/api/v1/contacts/:id/soft-delete', async (c) => {
  const id = c.req.param('id');

  try {
    const contact = await codex.softDeleteContact(id);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }
    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error soft-deleting contact:', error);
    return c.json({ success: false, error: 'Failed to soft-delete contact' }, 500);
  }
});

// Restore a soft-deleted contact
app.patch('/api/v1/contacts/:id/restore', async (c) => {
  const id = c.req.param('id');

  try {
    const contact = await codex.restoreContact(id);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }
    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error restoring contact:', error);
    return c.json({ success: false, error: 'Failed to restore contact' }, 500);
  }
});

// ============================================================================
// USER EMAIL PREFERENCES (JubileeOutlook)
// Blocked senders and ignored conversations for email filtering
// ============================================================================

// --- BLOCKED SENDERS ---

// Get all blocked senders for a user
app.get('/api/user-preferences/:userId/blocked-senders', async (c) => {
  const userId = c.req.param('userId');

  try {
    const blockedSenders = await codex.getBlockedSenders(userId);
    return c.json({ data: blockedSenders });
  } catch (error) {
    console.error('Error fetching blocked senders:', error);
    return c.json({ error: 'Failed to fetch blocked senders' }, 500);
  }
});

// Add a blocked sender
app.post('/api/user-preferences/:userId/blocked-senders', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json();

  if (!body.emailAddress) {
    return c.json({ error: 'emailAddress is required' }, 400);
  }

  try {
    const result = await codex.addBlockedSender(userId, body.emailAddress.toLowerCase().trim());

    await codex.createAuditLog({
      eventType: 'email.sender_blocked',
      eventCategory: 'preferences',
      userId,
      outcome: 'success',
      metadata: { emailAddress: body.emailAddress },
    });

    return c.json({ data: result }, 201);
  } catch (error: any) {
    // Handle unique constraint violation (already blocked)
    if (error.code === '23505') {
      return c.json({ data: { alreadyBlocked: true } });
    }
    console.error('Error adding blocked sender:', error);
    return c.json({ error: 'Failed to add blocked sender' }, 500);
  }
});

// Remove a blocked sender
app.delete('/api/user-preferences/:userId/blocked-senders/:email', async (c) => {
  const userId = c.req.param('userId');
  const email = decodeURIComponent(c.req.param('email'));

  try {
    const removed = await codex.removeBlockedSender(userId, email.toLowerCase().trim());

    if (removed) {
      await codex.createAuditLog({
        eventType: 'email.sender_unblocked',
        eventCategory: 'preferences',
        userId,
        outcome: 'success',
        metadata: { emailAddress: email },
      });
    }

    return c.json({ data: { removed } });
  } catch (error) {
    console.error('Error removing blocked sender:', error);
    return c.json({ error: 'Failed to remove blocked sender' }, 500);
  }
});

// --- IGNORED CONVERSATIONS ---

// Get all ignored conversations for a user
app.get('/api/user-preferences/:userId/ignored-conversations', async (c) => {
  const userId = c.req.param('userId');

  try {
    const ignoredConversations = await codex.getIgnoredConversations(userId);
    return c.json({ data: ignoredConversations });
  } catch (error) {
    console.error('Error fetching ignored conversations:', error);
    return c.json({ error: 'Failed to fetch ignored conversations' }, 500);
  }
});

// Add an ignored conversation
app.post('/api/user-preferences/:userId/ignored-conversations', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json();

  if (!body.conversationId) {
    return c.json({ error: 'conversationId is required' }, 400);
  }

  try {
    const result = await codex.addIgnoredConversation(userId, body.conversationId);

    await codex.createAuditLog({
      eventType: 'email.conversation_ignored',
      eventCategory: 'preferences',
      userId,
      outcome: 'success',
      metadata: { conversationId: body.conversationId },
    });

    return c.json({ data: result }, 201);
  } catch (error: any) {
    // Handle unique constraint violation (already ignored)
    if (error.code === '23505') {
      return c.json({ data: { alreadyIgnored: true } });
    }
    console.error('Error adding ignored conversation:', error);
    return c.json({ error: 'Failed to add ignored conversation' }, 500);
  }
});

// Remove an ignored conversation
app.delete('/api/user-preferences/:userId/ignored-conversations/:conversationId', async (c) => {
  const userId = c.req.param('userId');
  const conversationId = decodeURIComponent(c.req.param('conversationId'));

  try {
    const removed = await codex.removeIgnoredConversation(userId, conversationId);

    if (removed) {
      await codex.createAuditLog({
        eventType: 'email.conversation_unignored',
        eventCategory: 'preferences',
        userId,
        outcome: 'success',
        metadata: { conversationId },
      });
    }

    return c.json({ data: { removed } });
  } catch (error) {
    console.error('Error removing ignored conversation:', error);
    return c.json({ error: 'Failed to remove ignored conversation' }, 500);
  }
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
    console.log('  POST /api/auth/oauth-register   - OAuth user registration');
    console.log('  GET  /api/auth/me               - Get current user profile');
    console.log('  GET  /api/users/:id             - Get user by ID');
    console.log('  POST /api/users                 - Create user');
    console.log('  GET  /api/personas              - List personas');
    console.log('  GET  /api/feature-flags         - List feature flags');
    console.log('  GET  /api/settings              - Get public settings');
    console.log('  GET  /api/bible/books           - List Bible books');
    console.log('  GET  /api/v1/contacts           - List contacts');
    console.log('  GET  /api/v1/contacts/search    - Search contacts');
    console.log('  GET  /api/v1/contacts/:id       - Get contact');
    console.log('  POST /api/v1/contacts           - Create contact');
    console.log('  PUT  /api/v1/contacts/:id       - Update contact');
    console.log('  DEL  /api/v1/contacts/:id       - Delete contact');
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
