/**
 * Security middleware configuration
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Configure Helmet security headers
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://api.anthropic.com"]
    }
  },
  crossOriginEmbedderPolicy: false
});

/**
 * Custom key generator for rate limiting that handles IISNode properly
 * Falls back to session ID or user-agent hash to prevent all users sharing one bucket
 */
function getClientKey(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
  if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== 'unknown') {
    return ip;
  }
  // For local/IISNode requests, use session ID if available
  if (req.sessionID) {
    return `session:${req.sessionID}`;
  }
  // Last resort: use user-agent and accept-language for differentiation
  const ua = req.headers['user-agent'] || '';
  const lang = req.headers['accept-language'] || '';
  return `anon:${ua.slice(0, 50)}:${lang.slice(0, 20)}`;
}

/**
 * Check if request is for static assets (skip rate limiting)
 */
function isStaticAsset(req) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.map'];
  return staticExtensions.some(ext => req.path.endsWith(ext));
}

/**
 * Configure rate limiting
 */
const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  skip: isStaticAsset
});

/**
 * API-specific rate limiter (stricter)
 */
const apiRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 100, // Increased from 30 for IISNode compatibility
  message: {
    error: 'API rate limit exceeded. Please slow down.',
    retryAfter: 60
  },
  keyGenerator: getClientKey
});

module.exports = {
  helmetConfig,
  rateLimiter,
  apiRateLimiter
};
