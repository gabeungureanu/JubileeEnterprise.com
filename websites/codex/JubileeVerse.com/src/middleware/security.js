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
  // Use a custom key generator that handles undefined IPs (common with IIS/IISNode)
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  }
});

/**
 * API-specific rate limiter (stricter)
 */
const apiRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30,
  message: {
    error: 'API rate limit exceeded. Please slow down.',
    retryAfter: 60
  },
  // Use a custom key generator that handles undefined IPs (common with IIS/IISNode)
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  }
});

module.exports = {
  helmetConfig,
  rateLimiter,
  apiRateLimiter
};
