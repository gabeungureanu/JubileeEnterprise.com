/**
 * Session middleware configuration
 * Uses Redis for session storage in production for horizontal scaling
 * Uses PostgreSQL in development for session persistence across restarts
 */

const session = require('express-session');
const config = require('../config');
const logger = require('../utils/logger');

// Single shared middleware instance - MUST use getSessionMiddleware() to access
let _sessionMiddleware = null;
let pgPool = null;

/**
 * Set PostgreSQL pool for session store
 * MUST be called before getSessionMiddleware()
 */
function setPgPool(pool) {
  pgPool = pool;
}

/**
 * Create session middleware with PostgreSQL store
 */
function createPgSessionMiddleware() {
  if (!pgPool) {
    logger.warn('Session: PostgreSQL pool not available, using memory store');
    return createMemorySessionMiddleware();
  }

  try {
    const pgSession = require('connect-pg-simple')(session);

    // Determine if we should use secure cookies
    // In IISNode environment, we may be behind a proxy handling HTTPS
    // Use secure cookies only if explicitly configured or if we detect HTTPS
    const isIISNode = !!process.env.IISNODE_VERSION;
    const forceSecure = process.env.SESSION_SECURE === 'true';
    const forceInsecure = process.env.SESSION_SECURE === 'false';

    // Default: secure in production unless running under IISNode without explicit HTTPS config
    // This allows HTTP access in IISNode development scenarios
    let useSecureCookie = !config.server.isDev;
    if (forceSecure) {
      useSecureCookie = true;
    } else if (forceInsecure || isIISNode) {
      // IISNode typically handles HTTP, with IIS handling HTTPS termination
      // Allow non-secure cookies unless explicitly configured otherwise
      useSecureCookie = false;
    }

    const sessionConfig = {
      store: new pgSession({
        pool: pgPool,
        tableName: 'session_store',
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 15 // Prune expired sessions every 15 minutes
      }),
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      name: 'jv.sid',
      cookie: {
        secure: useSecureCookie,
        httpOnly: true,
        maxAge: config.session.maxAge,
        sameSite: 'lax'
      }
    };

    if (useSecureCookie) {
      logger.info('Session: Using secure cookies (HTTPS required)');
    } else {
      logger.info('Session: Using non-secure cookies (HTTP allowed)');
    }

    logger.info('Session: Using PostgreSQL store');
    return session(sessionConfig);
  } catch (error) {
    logger.warn('Session: PostgreSQL store failed, using memory store', { error: error.message });
    return createMemorySessionMiddleware();
  }
}

/**
 * Create session middleware with memory store
 */
function createMemorySessionMiddleware() {
  // Same secure cookie logic as PostgreSQL store
  const isIISNode = !!process.env.IISNODE_VERSION;
  const forceSecure = process.env.SESSION_SECURE === 'true';
  const forceInsecure = process.env.SESSION_SECURE === 'false';

  let useSecureCookie = !config.server.isDev;
  if (forceSecure) {
    useSecureCookie = true;
  } else if (forceInsecure || isIISNode) {
    useSecureCookie = false;
  }

  logger.info('Session: Using memory store');
  return session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    name: 'jv.sid',
    cookie: {
      secure: useSecureCookie,
      httpOnly: true,
      maxAge: config.session.maxAge,
      sameSite: 'lax'
    }
  });
}

/**
 * Create session middleware with Redis store (production)
 */
function createRedisSessionMiddleware(redisClient) {
  // Same secure cookie logic as other stores
  const isIISNode = !!process.env.IISNODE_VERSION;
  const forceSecure = process.env.SESSION_SECURE === 'true';
  const forceInsecure = process.env.SESSION_SECURE === 'false';

  let useSecureCookie = !config.server.isDev;
  if (forceSecure) {
    useSecureCookie = true;
  } else if (forceInsecure || isIISNode) {
    useSecureCookie = false;
  }

  const sessionConfig = {
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    name: 'jv.sid',
    cookie: {
      secure: useSecureCookie,
      httpOnly: true,
      maxAge: config.session.maxAge,
      sameSite: 'lax'
    }
  };

  try {
    const RedisStore = require('connect-redis').default;

    sessionConfig.store = new RedisStore({
      client: redisClient,
      prefix: 'jv:sess:',
      ttl: config.session.maxAge / 1000 // TTL in seconds
    });

    logger.info('Session: Using Redis store');
    return session(sessionConfig);
  } catch (error) {
    logger.warn('Session: Redis store failed, falling back', { error: error.message });
    return null;
  }
}

/**
 * Get or create session middleware
 * This is THE ONLY function that should be used to get the session middleware.
 * It MUST be called AFTER setPgPool() in the startup sequence.
 */
function getSessionMiddleware(redisClient = null) {
  if (!_sessionMiddleware) {
    // Priority: Redis (production) > PostgreSQL (development) > Memory (fallback)
    if (redisClient && !config.server.isDev) {
      _sessionMiddleware = createRedisSessionMiddleware(redisClient);
    }

    if (!_sessionMiddleware && pgPool && !pgPool.mock) {
      _sessionMiddleware = createPgSessionMiddleware();
    }

    if (!_sessionMiddleware) {
      _sessionMiddleware = createMemorySessionMiddleware();
    }
  }
  return _sessionMiddleware;
}

/**
 * Middleware to attach user session data to response locals
 */
const attachUserToLocals = (req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.isAuthenticated = !!req.session?.user;
  next();
};

/**
 * Require authentication middleware
 */
const requireAuth = (req, res, next) => {
  if (!req.session?.user && !req.session?.userId) {
    // Always return JSON for API routes, XHR requests, or JSON Accept header
    if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
};

/**
 * Redirect if already authenticated
 */
const redirectIfAuth = (req, res, next) => {
  if (req.session?.user || req.session?.userId) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: 'Already authenticated'
      });
    }
    return res.redirect('/dashboard');
  }
  next();
};

/**
 * Require specific role middleware
 */
const requireRole = (requiredRole) => {
  return async (req, res, next) => {
    // Check if user is authenticated (either user object or userId in session)
    if (!req.session?.user && !req.session?.userId) {
      // Always return JSON for API routes, XHR requests, or JSON Accept header
      if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    // Always fetch current role from database to ensure we have the latest
    // This prevents stale session data from blocking admin access after role changes
    let userRole = null;
    const userId = req.session?.userId || req.session?.user?.id;

    if (userId) {
      try {
        const { User } = require('../models');
        const user = await User.findById(userId);
        if (user) {
          userRole = user.role;
          // Update session with fresh user data
          req.session.user = user;
        }
      } catch (error) {
        // If database fetch fails, fall back to session role if available
        userRole = req.session?.user?.role || null;
      }
    }

    const roleHierarchy = ['user', 'contributor', 'reviewer', 'moderator', 'admin'];
    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
      // Always return JSON for API routes, XHR requests, or JSON Accept header
      if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
      return res.redirect('/');
    }

    next();
  };
};

// Convenience middleware for admin-only routes
const requireAdmin = requireRole('admin');

// Export session utilities - use getSessionMiddleware() to get the middleware
module.exports = {
  // Getter that returns the same instance as getSessionMiddleware()
  // This ensures only ONE middleware instance is ever created
  get sessionMiddleware() {
    return getSessionMiddleware();
  },
  setPgPool,
  getSessionMiddleware,
  attachUserToLocals,
  requireAuth,
  redirectIfAuth,
  requireRole,
  requireAdmin
};
