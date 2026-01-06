/**
 * Middleware Index
 * Exports all middleware modules
 */

const { helmetConfig, rateLimiter, apiRateLimiter } = require('./security');
const sessionModule = require('./session');
const {
  notFoundHandler,
  errorHandler,
  asyncHandler,
  AppError
} = require('./errorHandler');

module.exports = {
  // Security
  helmetConfig,
  rateLimiter,
  apiRateLimiter,

  // Session - use getter to avoid early initialization
  get sessionMiddleware() {
    return sessionModule.sessionMiddleware;
  },
  getSessionMiddleware: sessionModule.getSessionMiddleware,
  setPgPool: sessionModule.setPgPool,
  attachUserToLocals: sessionModule.attachUserToLocals,
  requireAuth: sessionModule.requireAuth,
  redirectIfAuth: sessionModule.redirectIfAuth,
  requireRole: sessionModule.requireRole,
  requireAdmin: sessionModule.requireAdmin,

  // Error handling
  notFoundHandler,
  errorHandler,
  asyncHandler,
  AppError
};
