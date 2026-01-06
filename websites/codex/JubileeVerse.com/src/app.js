/**
 * Express Application Configuration
 * Sets up middleware, routes, and error handlers
 * Separated from server.js for testability
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const routes = require('./routes');
const {
  helmetConfig,
  rateLimiter,
  getSessionMiddleware,
  attachUserToLocals,
  errorHandler,
  notFoundHandler
} = require('./middleware');
const { observabilityMiddleware, metricsHandler } = require('./observability');

/**
 * Create and configure Express application
 */
function createApp() {
  const app = express();

  // Trust proxy (for secure cookies behind reverse proxy)
  app.set('trust proxy', 1);

  // Observability (tracing, metrics) - must be first
  app.use(observabilityMiddleware({ slowThreshold: 5000 }));

  // Metrics endpoint (before other routes, typically restricted in production)
  app.get('/metrics', metricsHandler);

  // Security middleware
  app.use(helmetConfig);

  // CORS configuration
  app.use(cors({
    origin: config.cors.origins,
    credentials: true
  }));

  // Compression
  app.use(compression());

  // Request logging
  if (config.server.isDev) {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Session management (get middleware at runtime so PostgreSQL pool is available)
  app.use(getSessionMiddleware());
  app.use(attachUserToLocals);

  // Rate limiting
  app.use(rateLimiter);

  // Static files
  app.use(express.static(path.join(__dirname, '../website'), {
    maxAge: config.server.isDev ? 0 : '1d',
    etag: true
  }));

  // View partials as static for component loading
  app.use('/partials', express.static(path.join(__dirname, '../views/partials')));

  // Application routes
  app.use(routes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
