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
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initializePools, closePools, checkAllHealth } from '@jubilee/database';
import * as codex from '@jubilee/database/codex';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Wrap audit log writes so failures never cascade into 500 responses */
async function safeAuditLog(data: Parameters<typeof codex.createAuditLog>[0]) {
  try {
    await codex.createAuditLog(data);
  } catch (err) {
    console.warn('Audit log write failed (non-fatal):', err);
  }
}

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  credentials: true,
}));

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const RATE_LIMIT_MAX = 120; // 120 requests per minute per IP

app.use('/api/*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ success: false, error: 'Rate limit exceeded. Please try again later.' }, 429);
    }
  }

  // Periodically clean up stale entries (every ~100 requests)
  if (Math.random() < 0.01) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }

  await next();
});

// Serve uploaded files (contact photos, etc.)
app.use('/uploads/*', serveStatic({ root: './' }));

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

    await safeAuditLog({
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

  await safeAuditLog({
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

    await safeAuditLog({
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
        avatarUrl,
      });
      isNewUser = true;

      await safeAuditLog({
        eventType: 'user.oauth_registered',
        eventCategory: 'identity',
        userId: user.id,
        outcome: 'success',
        metadata: { email, provider, isNewUser: true },
      });
    } else {
      await safeAuditLog({
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
 * Validates an email address format
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates a URL format (accepts URLs with or without protocol prefix)
 */
function isValidUrl(url: string): boolean {
  try {
    // If no protocol, prepend https:// for validation
    const urlToTest = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    new URL(urlToTest);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates contact input fields, returns array of error messages (empty if valid)
 */
function validateContactInput(body: any): string[] {
  const errors: string[] = [];

  // All fields are optional — only validate format when provided

  if (body.emailAddresses && Array.isArray(body.emailAddresses)) {
    for (const email of body.emailAddresses) {
      if (typeof email === 'string' && email.trim() && !isValidEmail(email.trim())) {
        errors.push(`Invalid email format: ${email}`);
      }
    }
  }

  if (body.website && typeof body.website === 'string' && body.website.trim()) {
    if (!isValidUrl(body.website.trim())) {
      errors.push(`Invalid website URL: ${body.website}`);
    }
  }

  if (body.photoUrl && typeof body.photoUrl === 'string' && body.photoUrl.trim()) {
    if (!isValidUrl(body.photoUrl.trim())) {
      errors.push(`Invalid photo URL: ${body.photoUrl}`);
    }
  }

  if (body.displayName && typeof body.displayName === 'string' && body.displayName.length > 500) {
    errors.push('Display name must be 500 characters or less');
  }

  return errors;
}

/**
 * Extracts the requesting user ID from query params or X-User-Id header
 */
function getRequestUserId(c: any): string | undefined {
  return c.req.query('userId') || c.req.header('X-User-Id');
}

/**
 * Verifies the requesting user owns the contact. Returns the contact if valid, or null.
 */
async function verifyContactOwnership(contactId: string, requestingUserId: string, includeDeleted = false): Promise<any | null> {
  const contact = await codex.getContactById(contactId, includeDeleted);
  if (!contact) return null;
  if (contact.user_id !== requestingUserId) return null;
  return contact;
}

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
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const contact = await verifyContactOwnership(id, userId);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }
    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error fetching contact:', error);
    return c.json({ success: false, error: 'Failed to fetch contact' }, 500);
  }
});

// Check for duplicate contacts
app.post('/api/v1/contacts/check-duplicates', async (c) => {
  const userId = getRequestUserId(c);
  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const body = await c.req.json();
    const duplicates = await codex.findDuplicateContacts(
      userId,
      body.displayName,
      body.phoneNumbers,
      body.mobilePhone
    );

    return c.json({
      success: true,
      hasDuplicates: duplicates.length > 0,
      duplicates: duplicates.map(toCamelCase),
    });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return c.json({ success: false, error: 'Failed to check duplicates' }, 500);
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

  const validationErrors = validateContactInput(body);
  if (validationErrors.length > 0) {
    return c.json({ success: false, error: 'Validation failed', details: validationErrors }, 400);
  }

  try {
    // Check for duplicates unless explicitly skipped
    if (!body.skipDuplicateCheck) {
      const duplicates = await codex.findDuplicateContacts(
        userId,
        body.displayName,
        body.phoneNumbers,
        body.mobilePhone
      );

      if (duplicates.length > 0) {
        // Separate active vs soft-deleted matches
        const activeDupes = duplicates.filter((d: any) => !d.is_deleted);
        const deletedDupes = duplicates.filter((d: any) => d.is_deleted);

        if (activeDupes.length > 0) {
          return c.json({
            success: false,
            error: 'Contact already exists with the same Display Name and Phone Number.',
            code: 'DUPLICATE_DETECTED',
            duplicates: activeDupes.map(toCamelCase),
          }, 409);
        }

        if (deletedDupes.length > 0) {
          return c.json({
            success: false,
            error: 'A deleted contact with the same Display Name and Phone Number already exists. Consider restoring it instead.',
            code: 'DELETED_DUPLICATE_FOUND',
            duplicates: deletedDupes.map(toCamelCase),
          }, 409);
        }
      }
    }

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

    await safeAuditLog({
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
  const userId = getRequestUserId(c);
  const body = await c.req.json();

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  // Validate contact input (all fields are optional, only format checks)
  const validationErrors = validateContactInput(body);
  if (validationErrors.length > 0) {
    return c.json({ success: false, error: 'Validation failed', details: validationErrors }, 400);
  }

  try {
    // Verify ownership before update (include deleted contacts so restore works)
    const existing = await verifyContactOwnership(id, userId, true);
    if (!existing) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

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
      isDeleted: body.isDeleted,
      deletedAt: body.deletedAt,
    });

    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    await safeAuditLog({
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
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const existing = await verifyContactOwnership(id, userId, true);
    if (!existing) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    await codex.deleteContact(id);

    await safeAuditLog({
      eventType: 'contact.deleted',
      eventCategory: 'contacts',
      userId: existing.user_id,
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
  const userId = getRequestUserId(c);
  const body = await c.req.json();

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    // Verify ownership before toggling
    const existing = await verifyContactOwnership(id, userId);
    if (!existing) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    const contact = await codex.toggleContactFavorite(id, body.isFavorite ?? false);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    await safeAuditLog({
      eventType: body.isFavorite ? 'contact.favorited' : 'contact.unfavorited',
      eventCategory: 'contacts',
      userId: contact.user_id,
      resourceType: 'contact',
      resourceId: id,
      outcome: 'success',
      metadata: { displayName: contact.display_name, isFavorite: body.isFavorite },
    });

    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return c.json({ success: false, error: 'Failed to toggle favorite' }, 500);
  }
});

// Soft delete a contact
app.patch('/api/v1/contacts/:id/soft-delete', async (c) => {
  const id = c.req.param('id');
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    // Verify ownership before soft-deleting
    const existing = await verifyContactOwnership(id, userId);
    if (!existing) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    const contact = await codex.softDeleteContact(id);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    await safeAuditLog({
      eventType: 'contact.soft_deleted',
      eventCategory: 'contacts',
      userId: contact.user_id,
      resourceType: 'contact',
      resourceId: id,
      outcome: 'success',
      metadata: { displayName: contact.display_name },
    });

    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error soft-deleting contact:', error);
    return c.json({ success: false, error: 'Failed to soft-delete contact' }, 500);
  }
});

// Restore a soft-deleted contact
app.patch('/api/v1/contacts/:id/restore', async (c) => {
  const id = c.req.param('id');
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    // Verify ownership before restoring (include deleted contacts)
    const existing = await verifyContactOwnership(id, userId, true);
    if (!existing) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    const contact = await codex.restoreContact(id);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    await safeAuditLog({
      eventType: 'contact.restored',
      eventCategory: 'contacts',
      userId: contact.user_id,
      resourceType: 'contact',
      resourceId: id,
      outcome: 'success',
      metadata: { displayName: contact.display_name },
    });

    return c.json({ success: true, contact: toCamelCase(contact) });
  } catch (error) {
    console.error('Error restoring contact:', error);
    return c.json({ success: false, error: 'Failed to restore contact' }, 500);
  }
});

// Batch soft-delete contacts
app.post('/api/v1/contacts/batch/soft-delete', async (c) => {
  const body = await c.req.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, error: 'ids array is required' }, 400);
  }

  if (ids.length > 100) {
    return c.json({ success: false, error: 'Maximum 100 contacts per batch operation' }, 400);
  }

  try {
    const results = await Promise.all(ids.map((id: string) => codex.softDeleteContact(id)));
    const succeeded = results.filter(Boolean);

    if (succeeded.length > 0) {
      await safeAuditLog({
        eventType: 'contact.batch_soft_deleted',
        eventCategory: 'contacts',
        userId: succeeded[0].user_id,
        outcome: 'success',
        metadata: { count: succeeded.length, ids },
      });
    }

    return c.json({ success: true, deleted: succeeded.length, total: ids.length });
  } catch (error) {
    console.error('Error batch soft-deleting contacts:', error);
    return c.json({ success: false, error: 'Failed to batch soft-delete contacts' }, 500);
  }
});

// Batch restore contacts
app.post('/api/v1/contacts/batch/restore', async (c) => {
  const body = await c.req.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, error: 'ids array is required' }, 400);
  }

  if (ids.length > 100) {
    return c.json({ success: false, error: 'Maximum 100 contacts per batch operation' }, 400);
  }

  try {
    const results = await Promise.all(ids.map((id: string) => codex.restoreContact(id)));
    const succeeded = results.filter(Boolean);

    if (succeeded.length > 0) {
      await safeAuditLog({
        eventType: 'contact.batch_restored',
        eventCategory: 'contacts',
        userId: succeeded[0].user_id,
        outcome: 'success',
        metadata: { count: succeeded.length, ids },
      });
    }

    return c.json({ success: true, restored: succeeded.length, total: ids.length });
  } catch (error) {
    console.error('Error batch restoring contacts:', error);
    return c.json({ success: false, error: 'Failed to batch restore contacts' }, 500);
  }
});

// Batch update category
app.post('/api/v1/contacts/batch/category', async (c) => {
  const body = await c.req.json();
  const { ids, category } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, error: 'ids array is required' }, 400);
  }

  if (ids.length > 100) {
    return c.json({ success: false, error: 'Maximum 100 contacts per batch operation' }, 400);
  }

  if (category === undefined) {
    return c.json({ success: false, error: 'category is required (use null to clear)' }, 400);
  }

  try {
    const results = await Promise.all(
      ids.map((id: string) => codex.updateContact(id, { category: category || '' }))
    );
    const succeeded = results.filter(Boolean);

    if (succeeded.length > 0) {
      await safeAuditLog({
        eventType: 'contact.batch_category_updated',
        eventCategory: 'contacts',
        userId: succeeded[0].user_id,
        outcome: 'success',
        metadata: { count: succeeded.length, category, ids },
      });
    }

    return c.json({ success: true, updated: succeeded.length, total: ids.length });
  } catch (error) {
    console.error('Error batch updating category:', error);
    return c.json({ success: false, error: 'Failed to batch update category' }, 500);
  }
});

// Batch hard delete contacts
app.post('/api/v1/contacts/batch/delete', async (c) => {
  const body = await c.req.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, error: 'ids array is required' }, 400);
  }

  if (ids.length > 100) {
    return c.json({ success: false, error: 'Maximum 100 contacts per batch operation' }, 400);
  }

  try {
    let userId: string | undefined;
    for (const id of ids) {
      const existing = await codex.getContactById(id, true);
      if (existing && !userId) userId = existing.user_id;
    }

    const results = await Promise.all(ids.map((id: string) => codex.deleteContact(id)));
    const succeeded = results.filter(Boolean).length;

    if (succeeded > 0 && userId) {
      await safeAuditLog({
        eventType: 'contact.batch_deleted',
        eventCategory: 'contacts',
        userId,
        outcome: 'success',
        metadata: { count: succeeded, ids },
      });
    }

    return c.json({ success: true, deleted: succeeded, total: ids.length });
  } catch (error) {
    console.error('Error batch deleting contacts:', error);
    return c.json({ success: false, error: 'Failed to batch delete contacts' }, 500);
  }
});

// Upload contact photo
app.post('/api/v1/contacts/:id/photo', async (c) => {
  const id = c.req.param('id');
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const contact = await verifyContactOwnership(id, userId);
    if (!contact) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    const contentType = c.req.header('Content-Type') || '';
    let photoBuffer: Buffer;
    let extension: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('photo') as File | null;
      if (!file) {
        return c.json({ success: false, error: 'No photo file provided' }, 400);
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return c.json({ success: false, error: `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}` }, 400);
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return c.json({ success: false, error: 'File too large. Maximum size is 5MB' }, 400);
      }

      photoBuffer = Buffer.from(await file.arrayBuffer());
      extension = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    } else if (contentType.includes('application/json')) {
      const body = await c.req.json();
      if (!body.photoBase64) {
        return c.json({ success: false, error: 'photoBase64 is required' }, 400);
      }

      const match = body.photoBase64.match(/^data:image\/(jpeg|png|gif|webp);base64,(.+)$/);
      if (match) {
        extension = match[1] === 'jpeg' ? 'jpg' : match[1];
        photoBuffer = Buffer.from(match[2], 'base64');
      } else {
        extension = 'jpg';
        photoBuffer = Buffer.from(body.photoBase64, 'base64');
      }

      const maxSize = 5 * 1024 * 1024;
      if (photoBuffer.length > maxSize) {
        return c.json({ success: false, error: 'File too large. Maximum size is 5MB' }, 400);
      }
    } else {
      return c.json({ success: false, error: 'Content-Type must be multipart/form-data or application/json' }, 400);
    }

    const uploadDir = join(process.cwd(), 'uploads', 'photos');
    await mkdir(uploadDir, { recursive: true });

    const filename = `${id}_${randomUUID()}.${extension}`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, photoBuffer);

    const photoUrl = `/uploads/photos/${filename}`;
    await codex.updateContact(id, { photoUrl });

    await safeAuditLog({
      eventType: 'contact.photo_uploaded',
      eventCategory: 'contacts',
      userId: contact.user_id,
      resourceType: 'contact',
      resourceId: id,
      outcome: 'success',
      metadata: { filename, size: photoBuffer.length },
    });

    return c.json({ success: true, photoUrl });
  } catch (error) {
    console.error('Error uploading contact photo:', error);
    return c.json({ success: false, error: 'Failed to upload photo' }, 500);
  }
});

// ============================================================================
// CONTACT IMPORT / EXPORT ENDPOINTS
// ============================================================================

/**
 * Parse a vCard string into contact objects
 */
function parseVCard(vcardContent: string): any[] {
  const contacts: any[] = [];
  const vcards = vcardContent.split('END:VCARD')
    .map(v => v.trim())
    .filter(v => v.includes('BEGIN:VCARD'));

  for (const vcard of vcards) {
    const lines = vcard.split(/\r?\n/);
    const contact: any = {
      emailAddresses: [],
      phoneNumbers: [],
    };

    for (const line of lines) {
      if (line.startsWith('FN:') || line.startsWith('FN;')) {
        contact.displayName = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('N:') || line.startsWith('N;')) {
        const parts = line.split(':').slice(1).join(':').split(';');
        contact.lastName = parts[0]?.trim() || '';
        contact.firstName = parts[1]?.trim() || '';
        contact.middleName = parts[2]?.trim() || '';
        contact.title = parts[3]?.trim() || '';
        contact.suffix = parts[4]?.trim() || '';
      } else if (line.startsWith('EMAIL')) {
        const email = line.split(':').slice(1).join(':').trim();
        if (email) contact.emailAddresses.push(email);
      } else if (line.startsWith('TEL')) {
        const phone = line.split(':').slice(1).join(':').trim();
        if (phone) contact.phoneNumbers.push(phone);
      } else if (line.startsWith('ORG:') || line.startsWith('ORG;')) {
        contact.company = line.split(':').slice(1).join(':').split(';')[0]?.trim();
        contact.department = line.split(':').slice(1).join(':').split(';')[1]?.trim();
      } else if (line.startsWith('TITLE:') || line.startsWith('TITLE;')) {
        contact.jobTitle = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('NOTE:') || line.startsWith('NOTE;')) {
        contact.notes = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('URL:') || line.startsWith('URL;')) {
        contact.website = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('BDAY:')) {
        contact.birthday = line.split(':')[1]?.trim();
      } else if (line.startsWith('ANNIVERSARY:') || line.startsWith('X-ANNIVERSARY:')) {
        contact.anniversary = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('X-SPOUSE:') || line.startsWith('X-MS-SPOUSE:')) {
        contact.spouse = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('NICKNAME:')) {
        contact.nickname = line.split(':')[1]?.trim();
      } else if (line.startsWith('ADR')) {
        const parts = line.split(':').slice(1).join(':').split(';');
        contact.address = parts[2]?.trim() || '';
        contact.city = parts[3]?.trim() || '';
        contact.state = parts[4]?.trim() || '';
        contact.postalCode = parts[5]?.trim() || '';
        contact.country = parts[6]?.trim() || '';
      } else if (line.startsWith('CATEGORIES:')) {
        contact.category = line.split(':')[1]?.trim();
      }
    }

    if (!contact.displayName) {
      contact.displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed Contact';
    }

    contacts.push(contact);
  }

  return contacts;
}

/**
 * Generate a vCard string from a database contact row
 */
function contactToVCard(contact: any): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  if (contact.display_name) lines.push(`FN:${contact.display_name}`);
  lines.push(`N:${contact.last_name || ''};${contact.first_name || ''};${contact.middle_name || ''};${contact.title || ''};${contact.suffix || ''}`);

  const emails = Array.isArray(contact.email_addresses) ? contact.email_addresses : [];
  for (const email of emails) {
    lines.push(`EMAIL:${email}`);
  }

  const phones = Array.isArray(contact.phone_numbers) ? contact.phone_numbers : [];
  for (const phone of phones) {
    lines.push(`TEL:${phone}`);
  }

  if (contact.mobile_phone) lines.push(`TEL;TYPE=CELL:${contact.mobile_phone}`);
  if (contact.company || contact.department) {
    lines.push(`ORG:${contact.company || ''};${contact.department || ''}`);
  }
  if (contact.job_title) lines.push(`TITLE:${contact.job_title}`);
  if (contact.nickname) lines.push(`NICKNAME:${contact.nickname}`);
  if (contact.notes) lines.push(`NOTE:${contact.notes}`);
  if (contact.website) lines.push(`URL:${contact.website}`);
  if (contact.birthday) lines.push(`BDAY:${contact.birthday}`);
  if (contact.anniversary) lines.push(`ANNIVERSARY:${contact.anniversary}`);
  if (contact.spouse) lines.push(`X-SPOUSE:${contact.spouse}`);
  if (contact.category) lines.push(`CATEGORIES:${contact.category}`);

  if (contact.address || contact.city || contact.state || contact.postal_code || contact.country) {
    lines.push(`ADR:;;${contact.address || ''};${contact.city || ''};${contact.state || ''};${contact.postal_code || ''};${contact.country || ''}`);
  }

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/**
 * Parse CSV content into contact objects
 */
function parseCsvContacts(csvContent: string): any[] {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const contacts: any[] = [];

  const headerMap: Record<string, string> = {
    'first name': 'firstName', 'firstname': 'firstName',
    'last name': 'lastName', 'lastname': 'lastName',
    'display name': 'displayName', 'displayname': 'displayName', 'name': 'displayName',
    'email': 'email', 'e-mail': 'email', 'email address': 'email',
    'phone': 'phone', 'telephone': 'phone', 'phone number': 'phone',
    'mobile': 'mobilePhone', 'mobile phone': 'mobilePhone', 'cell': 'mobilePhone',
    'company': 'company', 'organization': 'company', 'org': 'company',
    'job title': 'jobTitle', 'jobtitle': 'jobTitle', 'title': 'jobTitle',
    'department': 'department',
    'address': 'address', 'street': 'address',
    'city': 'city',
    'state': 'state', 'province': 'state',
    'zip': 'postalCode', 'postal code': 'postalCode', 'zipcode': 'postalCode',
    'country': 'country',
    'notes': 'notes',
    'website': 'website', 'url': 'website',
    'nickname': 'nickname',
    'category': 'category',
  };

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const contact: any = { emailAddresses: [], phoneNumbers: [] };

    for (let j = 0; j < headers.length && j < values.length; j++) {
      const mapped = headerMap[headers[j]];
      if (!mapped || !values[j]) continue;

      if (mapped === 'email') {
        contact.emailAddresses.push(values[j]);
      } else if (mapped === 'phone') {
        contact.phoneNumbers.push(values[j]);
      } else {
        contact[mapped] = values[j];
      }
    }

    if (!contact.displayName) {
      contact.displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed Contact';
    }

    contacts.push(contact);
  }

  return contacts;
}

// Import contacts from vCard
app.post('/api/v1/contacts/import/vcard', async (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const body = await c.req.json();
    if (!body.vcardContent || typeof body.vcardContent !== 'string') {
      return c.json({ success: false, error: 'vcardContent is required' }, 400);
    }

    const parsed = parseVCard(body.vcardContent);
    if (parsed.length === 0) {
      return c.json({ success: false, error: 'No valid contacts found in vCard data' }, 400);
    }

    if (parsed.length > 500) {
      return c.json({ success: false, error: 'Maximum 500 contacts per import' }, 400);
    }

    const imported: any[] = [];
    for (const contact of parsed) {
      const created = await codex.createContact({ userId, ...contact });
      imported.push(toCamelCase(created));
    }

    await safeAuditLog({
      eventType: 'contact.import_vcard',
      eventCategory: 'contacts',
      userId,
      resourceType: 'contact',
      outcome: 'success',
      metadata: { count: imported.length, format: 'vcard' },
    });

    return c.json({ success: true, imported: imported.length, contacts: imported });
  } catch (error) {
    console.error('Error importing vCard contacts:', error);
    return c.json({ success: false, error: 'Failed to import contacts' }, 500);
  }
});

// Import contacts from CSV
app.post('/api/v1/contacts/import/csv', async (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const body = await c.req.json();
    if (!body.csvContent || typeof body.csvContent !== 'string') {
      return c.json({ success: false, error: 'csvContent is required' }, 400);
    }

    const parsed = parseCsvContacts(body.csvContent);
    if (parsed.length === 0) {
      return c.json({ success: false, error: 'No valid contacts found in CSV data' }, 400);
    }

    if (parsed.length > 500) {
      return c.json({ success: false, error: 'Maximum 500 contacts per import' }, 400);
    }

    const imported: any[] = [];
    for (const contact of parsed) {
      const created = await codex.createContact({ userId, ...contact });
      imported.push(toCamelCase(created));
    }

    await safeAuditLog({
      eventType: 'contact.import_csv',
      eventCategory: 'contacts',
      userId,
      resourceType: 'contact',
      outcome: 'success',
      metadata: { count: imported.length, format: 'csv' },
    });

    return c.json({ success: true, imported: imported.length, contacts: imported });
  } catch (error) {
    console.error('Error importing CSV contacts:', error);
    return c.json({ success: false, error: 'Failed to import contacts' }, 500);
  }
});

// Export contacts as vCard
app.get('/api/v1/contacts/export/vcard', async (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const { contacts } = await codex.getContacts(userId, 1, 10000);
    const vcardContent = contacts.map(contactToVCard).join('\r\n');

    await safeAuditLog({
      eventType: 'contact.export_vcard',
      eventCategory: 'contacts',
      userId,
      resourceType: 'contact',
      outcome: 'success',
      metadata: { count: contacts.length, format: 'vcard' },
    });

    c.header('Content-Type', 'text/vcard; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="contacts.vcf"');
    return c.body(vcardContent);
  } catch (error) {
    console.error('Error exporting vCard contacts:', error);
    return c.json({ success: false, error: 'Failed to export contacts' }, 500);
  }
});

// Export contacts as CSV
app.get('/api/v1/contacts/export/csv', async (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const { contacts } = await codex.getContacts(userId, 1, 10000);

    const csvHeaders = ['First Name', 'Last Name', 'Display Name', 'Email', 'Phone', 'Mobile Phone',
      'Company', 'Job Title', 'Department', 'Address', 'City', 'State', 'Postal Code', 'Country',
      'Website', 'Birthday', 'Anniversary', 'Spouse', 'Nickname', 'Category', 'Notes'];
    const csvLines = [csvHeaders.join(',')];

    for (const c of contacts) {
      const emails = Array.isArray(c.email_addresses) ? c.email_addresses : [];
      const phones = Array.isArray(c.phone_numbers) ? c.phone_numbers : [];
      const row = [
        c.first_name, c.last_name, c.display_name,
        emails[0] || '', phones[0] || '', c.mobile_phone || '',
        c.company, c.job_title, c.department,
        c.address, c.city, c.state, c.postal_code, c.country,
        c.website, c.birthday, c.anniversary, c.spouse, c.nickname, c.category,
        c.notes,
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`);
      csvLines.push(row.join(','));
    }

    await safeAuditLog({
      eventType: 'contact.export_csv',
      eventCategory: 'contacts',
      userId,
      resourceType: 'contact',
      outcome: 'success',
      metadata: { count: contacts.length, format: 'csv' },
    });

    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="contacts.csv"');
    return c.body(csvLines.join('\r\n'));
  } catch (error) {
    console.error('Error exporting CSV contacts:', error);
    return c.json({ success: false, error: 'Failed to export contacts' }, 500);
  }
});

// ============================================================================
// CONTACT GROUPS MANAGEMENT
// ============================================================================

// Get all contact groups for a user
app.get('/api/v1/contact-groups', async (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const result = await codex.getContactGroups(userId);
    return c.json({ success: true, data: result.map(toCamelCase) });
  } catch (error) {
    console.error('Error fetching contact groups:', error);
    return c.json({ success: false, error: 'Failed to fetch contact groups' }, 500);
  }
});

// Get a single contact group with its members
app.get('/api/v1/contact-groups/:id', async (c) => {
  const id = c.req.param('id');
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const group = await codex.getContactGroupById(id);
    if (!group || group.user_id !== userId) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    const members = await codex.getContactGroupMembers(id);
    return c.json({
      success: true,
      data: { ...toCamelCase(group), members: members.map(toCamelCase) },
    });
  } catch (error) {
    console.error('Error fetching contact group:', error);
    return c.json({ success: false, error: 'Failed to fetch contact group' }, 500);
  }
});

// Create a new contact group
app.post('/api/v1/contact-groups', async (c) => {
  const userId = getRequestUserId(c);
  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    const body = await c.req.json();
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return c.json({ success: false, error: 'Group name is required' }, 400);
    }

    if (body.name.length > 200) {
      return c.json({ success: false, error: 'Group name must be 200 characters or less' }, 400);
    }

    const group = await codex.createContactGroup(userId, body.name.trim(), body.description?.trim());

    await safeAuditLog({
      eventType: 'contact_group.created',
      eventCategory: 'contacts',
      userId,
      resourceType: 'contact_group',
      resourceId: group.id,
      outcome: 'success',
      metadata: { name: body.name.trim() },
    });

    return c.json({ success: true, data: toCamelCase(group) }, 201);
  } catch (error) {
    console.error('Error creating contact group:', error);
    return c.json({ success: false, error: 'Failed to create contact group' }, 500);
  }
});

// Update a contact group
app.put('/api/v1/contact-groups/:id', async (c) => {
  const id = c.req.param('id');
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    // Verify ownership before update
    const existing = await codex.getContactGroupById(id);
    if (!existing || existing.user_id !== userId) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    const body = await c.req.json();
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return c.json({ success: false, error: 'Group name is required' }, 400);
    }

    const group = await codex.updateContactGroup(id, body.name.trim(), body.description?.trim());
    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    return c.json({ success: true, data: toCamelCase(group) });
  } catch (error) {
    console.error('Error updating contact group:', error);
    return c.json({ success: false, error: 'Failed to update contact group' }, 500);
  }
});

// Delete a contact group
app.delete('/api/v1/contact-groups/:id', async (c) => {
  const id = c.req.param('id');
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    // Verify ownership before delete
    const existing = await codex.getContactGroupById(id);
    if (!existing || existing.user_id !== userId) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    await codex.deleteContactGroup(id);

    await safeAuditLog({
      eventType: 'contact_group.deleted',
      eventCategory: 'contacts',
      userId,
      resourceType: 'contact_group',
      resourceId: id,
      outcome: 'success',
      metadata: { name: existing.name },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact group:', error);
    return c.json({ success: false, error: 'Failed to delete contact group' }, 500);
  }
});

// Add contacts to a group
app.post('/api/v1/contact-groups/:id/members', async (c) => {
  const groupId = c.req.param('id');
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    // Verify group ownership
    const group = await codex.getContactGroupById(groupId);
    if (!group || group.user_id !== userId) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    const body = await c.req.json();
    const contactIds = body.contactIds;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return c.json({ success: false, error: 'contactIds array is required' }, 400);
    }

    if (contactIds.length > 100) {
      return c.json({ success: false, error: 'Maximum 100 contacts per operation' }, 400);
    }

    // Verify all contacts belong to the same user
    const validContactIds: string[] = [];
    for (const contactId of contactIds) {
      const contact = await verifyContactOwnership(contactId, userId);
      if (contact) validContactIds.push(contactId);
    }

    if (validContactIds.length === 0) {
      return c.json({ success: false, error: 'No valid contacts found' }, 400);
    }

    const added = await codex.addContactsToGroup(groupId, validContactIds);
    return c.json({ success: true, added });
  } catch (error) {
    console.error('Error adding contacts to group:', error);
    return c.json({ success: false, error: 'Failed to add contacts to group' }, 500);
  }
});

// Remove a contact from a group
app.delete('/api/v1/contact-groups/:id/members/:contactId', async (c) => {
  const groupId = c.req.param('id');
  const contactId = c.req.param('contactId');
  const userId = getRequestUserId(c);

  if (!userId) {
    return c.json({ success: false, error: 'userId is required' }, 400);
  }

  try {
    // Verify group ownership
    const group = await codex.getContactGroupById(groupId);
    if (!group || group.user_id !== userId) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    const removed = await codex.removeContactFromGroup(groupId, contactId);
    if (!removed) {
      return c.json({ success: false, error: 'Contact not found in group' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing contact from group:', error);
    return c.json({ success: false, error: 'Failed to remove contact from group' }, 500);
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

    await safeAuditLog({
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
      await safeAuditLog({
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

    await safeAuditLog({
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
      await safeAuditLog({
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
