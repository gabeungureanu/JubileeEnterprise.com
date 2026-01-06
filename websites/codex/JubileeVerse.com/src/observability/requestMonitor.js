/**
 * Request Monitoring Middleware
 * Collects metrics and traces for all HTTP requests
 */

const onFinished = require('on-finished');
const metrics = require('./metrics');
const { tracingMiddleware } = require('./tracing');
const logger = require('../utils/logger');

/**
 * Performance monitoring middleware
 * Tracks request duration, status codes, and other metrics
 */
function performanceMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();

  // Increment in-progress gauge
  metrics.httpRequestsInProgress.inc({ method: req.method });

  // When response finishes
  onFinished(res, (err, res) => {
    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationSeconds = durationNs / 1e9;

    // Decrement in-progress gauge
    metrics.httpRequestsInProgress.dec({ method: req.method });

    // Get route path (use matched route if available, otherwise path)
    const route = req.route?.path || req.path || 'unknown';

    // Record metrics
    metrics.recordHttpRequest(
      req.method,
      route,
      res.statusCode,
      durationSeconds
    );

    // Log request completion with trace context
    const logLevel = res.statusCode >= 500 ? 'error' :
                     res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('Request completed', {
      traceId: req.trace?.traceId,
      requestId: req.trace?.requestId,
      method: req.method,
      path: req.path,
      route,
      statusCode: res.statusCode,
      durationMs: Math.round(durationSeconds * 1000),
      contentLength: res.get('content-length'),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.session?.userId
    });

    // Record errors
    if (res.statusCode >= 400) {
      metrics.recordError(
        res.statusCode >= 500 ? 'server' : 'client',
        res.statusCode
      );
    }
  });

  next();
}

/**
 * Slow request detection middleware
 * Warns when requests take longer than threshold
 */
function slowRequestMiddleware(thresholdMs = 5000) {
  return (req, res, next) => {
    const startTime = Date.now();

    onFinished(res, () => {
      const duration = Date.now() - startTime;

      if (duration > thresholdMs) {
        logger.warn('Slow request detected', {
          traceId: req.trace?.traceId,
          method: req.method,
          path: req.path,
          durationMs: duration,
          thresholdMs,
          query: Object.keys(req.query).length > 0 ? req.query : undefined
        });
      }
    });

    next();
  };
}

/**
 * Request size tracking middleware
 */
function requestSizeMiddleware(req, res, next) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (contentLength > 1024 * 1024) { // > 1MB
    logger.info('Large request received', {
      traceId: req.trace?.traceId,
      method: req.method,
      path: req.path,
      contentLength,
      contentType: req.headers['content-type']
    });
  }

  next();
}

/**
 * Combined observability middleware
 * Applies tracing, metrics, and logging in the correct order
 */
function observabilityMiddleware(options = {}) {
  const slowThreshold = options.slowThreshold || 5000;

  return [
    tracingMiddleware,
    performanceMiddleware,
    slowRequestMiddleware(slowThreshold),
    requestSizeMiddleware
  ];
}

/**
 * Metrics endpoint handler
 */
async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', metrics.getContentType());
    res.end(await metrics.getMetrics());
  } catch (error) {
    logger.error('Failed to collect metrics', { error });
    res.status(500).end('Error collecting metrics');
  }
}

module.exports = {
  performanceMiddleware,
  slowRequestMiddleware,
  requestSizeMiddleware,
  observabilityMiddleware,
  tracingMiddleware,
  metricsHandler
};
