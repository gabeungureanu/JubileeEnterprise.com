/**
 * Observability Module Index
 * Exports metrics, tracing, and monitoring functionality
 */

const metrics = require('./metrics');
const tracing = require('./tracing');
const requestMonitor = require('./requestMonitor');

module.exports = {
  // Metrics
  metrics,
  getMetrics: metrics.getMetrics,
  getContentType: metrics.getContentType,

  // Tracing
  tracing,
  tracingMiddleware: tracing.tracingMiddleware,
  createAsyncTraceContext: tracing.createAsyncTraceContext,
  serializeTraceContext: tracing.serializeTraceContext,
  deserializeTraceContext: tracing.deserializeTraceContext,

  // Request monitoring
  requestMonitor,
  observabilityMiddleware: requestMonitor.observabilityMiddleware,
  performanceMiddleware: requestMonitor.performanceMiddleware,
  metricsHandler: requestMonitor.metricsHandler,

  // Combined setup function
  setup: (app, options = {}) => {
    // Apply observability middleware
    app.use(requestMonitor.observabilityMiddleware(options));

    // Add metrics endpoint (usually protected or on separate port)
    if (options.metricsPath !== false) {
      app.get(options.metricsPath || '/metrics', requestMonitor.metricsHandler);
    }

    return app;
  }
};
