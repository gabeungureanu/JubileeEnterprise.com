import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, getAuth, optionalAuthMiddleware } from '../middleware/auth.js';
import {
  getAllTLDs,
  getTLDByName,
  checkDomainAvailability,
  registerDomain,
  getDomainById,
  getUserDomains,
  updateDomainSettings,
  normalizeDomainName,
  isValidDomainName,
} from '../services/domain-registry.js';
import { createDomainPayment, createRenewalPayment, getRegistrationHistory } from '../services/payment.js';
import { getConfig } from '../config/index.js';

const domains = new Hono();

// =============================================================================
// Public Routes
// =============================================================================

// Get all available TLDs
domains.get('/tlds', async (c) => {
  const includeRestricted = c.req.query('includeRestricted') === 'true';
  const tlds = await getAllTLDs(includeRestricted);
  return c.json({ tlds });
});

// Get specific TLD info
domains.get('/tlds/:tld', async (c) => {
  const tld = await getTLDByName(c.req.param('tld'));
  if (tld === null) {
    return c.json({ error: 'not_found', error_description: 'TLD not found' }, 404);
  }
  return c.json({ tld });
});

// Check domain availability (public, no auth required)
const availabilitySchema = z.object({
  name: z.string().min(1).max(63),
  tlds: z.array(z.string()).optional(),
});

domains.post('/check', async (c) => {
  const body = await c.req.json();
  const parsed = availabilitySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid domain name',
      details: parsed.error.errors,
    }, 400);
  }

  const { name, tlds } = parsed.data;

  if (!isValidDomainName(name)) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid domain name format. Use only letters, numbers, and hyphens.',
    }, 400);
  }

  const result = await checkDomainAvailability(name, tlds);
  return c.json(result);
});

// Quick availability check (GET)
domains.get('/check/:name', async (c) => {
  const name = c.req.param('name');

  if (!isValidDomainName(name)) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid domain name format',
    }, 400);
  }

  const result = await checkDomainAvailability(name);
  return c.json(result);
});

// Resolve domain info (for Jubilee Browser)
domains.get('/resolve/:fullDomain', optionalAuthMiddleware, async (c) => {
  const fullDomain = c.req.param('fullDomain').toLowerCase();

  // Parse domain
  const parts = fullDomain.split('.');
  if (parts.length < 2) {
    return c.json({ error: 'invalid_domain' }, 400);
  }

  const tldName = parts.pop()!;
  const domainName = parts.join('.');

  const tld = await getTLDByName(tldName);
  if (tld === null) {
    return c.json({
      exists: false,
      error: 'unknown_tld',
      message: `The .${tldName} is not a valid Inspire Web Space TLD`,
    }, 404);
  }

  const { getDatabase } = await import('../db/database.js');
  const db = getDatabase();

  const [domain] = await db`
    SELECT
      d.id, d.full_domain, d.status, d.owner_id,
      d.metadata, d.registered_at, d.expires_at
    FROM jubilee_domains d
    WHERE d.full_domain = ${fullDomain}
      AND d.status = 'active'
  `;

  if (domain === undefined) {
    return c.json({
      exists: false,
      fullDomain,
      tld: tldName,
      message: 'This web space is not registered on Inspire Web Spaces',
    });
  }

  // Get any JUBILEE records for this domain
  const records = await db`
    SELECT record_type, name, value, ttl
    FROM domain_records
    WHERE domain_id = ${domain.id}
      AND is_active = true
  `;

  return c.json({
    exists: true,
    fullDomain,
    tld: tldName,
    status: domain.status,
    metadata: domain.metadata,
    records,
  });
});

// =============================================================================
// Authenticated Routes
// =============================================================================

// Register a new domain
const registerSchema = z.object({
  name: z.string().min(1).max(63),
  tld: z.string().min(1),
  years: z.number().int().min(1).max(10).optional().default(1),
  autoRenew: z.boolean().optional().default(true),
});

domains.post('/register', authMiddleware, async (c) => {
  const auth = getAuth(c);
  const config = getConfig();
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid registration request',
      details: parsed.error.errors,
    }, 400);
  }

  const { name, tld, years, autoRenew } = parsed.data;

  if (!isValidDomainName(name)) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid domain name format',
    }, 400);
  }

  const tldInfo = await getTLDByName(tld);
  if (tldInfo === null) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Invalid TLD',
    }, 400);
  }

  try {
    const domain = await registerDomain({
      name: normalizeDomainName(name),
      tldId: tldInfo.id,
      ownerId: auth.user.id,
      years,
      autoRenew,
    });

    // Calculate price
    const amount = tldInfo.pricePerYear * years;

    // Create payment session
    const paymentResult = await createDomainPayment({
      domainId: domain.id,
      userId: auth.user.id,
      years,
      amount,
      successUrl: `${config.FRONTEND_URL}/domains/success`,
      cancelUrl: `${config.FRONTEND_URL}/domains/register?cancelled=true`,
    });

    if (!paymentResult.success) {
      return c.json({
        error: 'payment_failed',
        error_description: paymentResult.error,
      }, 500);
    }

    return c.json({
      success: true,
      domain,
      payment: {
        required: true,
        url: paymentResult.paymentUrl,
        sessionId: paymentResult.sessionId,
        amount,
        currency: 'USD',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return c.json({
      error: 'registration_failed',
      error_description: message,
    }, 400);
  }
});

// Get user's domains
domains.get('/my', authMiddleware, async (c) => {
  const auth = getAuth(c);
  const userDomains = await getUserDomains(auth.user.id);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const activeDomains = userDomains.filter((d) => d.status === 'active');
  const expiringSoon = userDomains.filter(
    (d) => d.expiresAt !== null && d.expiresAt <= thirtyDaysFromNow && d.expiresAt > now
  );

  return c.json({
    totalDomains: userDomains.length,
    activeDomains: activeDomains.length,
    expiringSoon: expiringSoon.length,
    domains: userDomains,
  });
});

// Get specific domain
domains.get('/:id', authMiddleware, async (c) => {
  const auth = getAuth(c);
  const domain = await getDomainById(c.req.param('id'));

  if (domain === null) {
    return c.json({ error: 'not_found', error_description: 'Domain not found' }, 404);
  }

  if (domain.ownerId !== auth.user.id) {
    return c.json({ error: 'forbidden', error_description: 'Not authorized' }, 403);
  }

  const history = await getRegistrationHistory(domain.id);

  return c.json({ domain, history });
});

// Update domain settings
const updateSchema = z.object({
  autoRenew: z.boolean().optional(),
  metadata: z.object({
    description: z.string().optional(),
    category: z.string().optional(),
  }).optional(),
});

domains.patch('/:id', authMiddleware, async (c) => {
  const auth = getAuth(c);
  const domain = await getDomainById(c.req.param('id'));

  if (domain === null) {
    return c.json({ error: 'not_found', error_description: 'Domain not found' }, 404);
  }

  if (domain.ownerId !== auth.user.id) {
    return c.json({ error: 'forbidden', error_description: 'Not authorized' }, 403);
  }

  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'invalid_request', details: parsed.error.errors }, 400);
  }

  const updated = await updateDomainSettings(domain.id, {
    autoRenew: parsed.data.autoRenew,
    metadata: parsed.data.metadata,
  });

  return c.json({ domain: updated });
});

// Renew domain
domains.post('/:id/renew', authMiddleware, async (c) => {
  const auth = getAuth(c);
  const config = getConfig();
  const domain = await getDomainById(c.req.param('id'));

  if (domain === null) {
    return c.json({ error: 'not_found', error_description: 'Domain not found' }, 404);
  }

  if (domain.ownerId !== auth.user.id) {
    return c.json({ error: 'forbidden', error_description: 'Not authorized' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const years = Math.min(Math.max(parseInt(body.years, 10) || 1, 1), 10);

  const paymentResult = await createRenewalPayment(
    domain.id,
    auth.user.id,
    years,
    `${config.FRONTEND_URL}/domains/${domain.id}?renewed=true`,
    `${config.FRONTEND_URL}/domains/${domain.id}?cancelled=true`
  );

  if (!paymentResult.success) {
    return c.json({
      error: 'payment_failed',
      error_description: paymentResult.error,
    }, 500);
  }

  return c.json({
    success: true,
    payment: {
      url: paymentResult.paymentUrl,
      sessionId: paymentResult.sessionId,
    },
  });
});

export { domains };
