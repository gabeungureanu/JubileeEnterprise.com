/**
 * Prometheus Metrics
 * Exposes application metrics for monitoring and alerting
 */

const client = require('prom-client');
const config = require('../config');

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'jubileeverse_',
  labels: { app: 'jubileeverse', env: config.server.env }
});

// ============================================
// Custom Application Metrics
// ============================================

// HTTP Request metrics
const httpRequestDuration = new client.Histogram({
  name: 'jubileeverse_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});
register.registerMetric(httpRequestDuration);

const httpRequestTotal = new client.Counter({
  name: 'jubileeverse_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestTotal);

const httpRequestsInProgress = new client.Gauge({
  name: 'jubileeverse_http_requests_in_progress',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method']
});
register.registerMetric(httpRequestsInProgress);

// AI/Chat metrics
const aiResponseDuration = new client.Histogram({
  name: 'jubileeverse_ai_response_duration_seconds',
  help: 'Duration of AI response generation in seconds',
  labelNames: ['persona_id', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60]
});
register.registerMetric(aiResponseDuration);

const aiRequestsTotal = new client.Counter({
  name: 'jubileeverse_ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['persona_id', 'status', 'async']
});
register.registerMetric(aiRequestsTotal);

const conversationsActive = new client.Gauge({
  name: 'jubileeverse_conversations_active',
  help: 'Number of active conversations'
});
register.registerMetric(conversationsActive);

// Queue metrics
const queueJobsTotal = new client.Counter({
  name: 'jubileeverse_queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status']
});
register.registerMetric(queueJobsTotal);

const queueJobDuration = new client.Histogram({
  name: 'jubileeverse_queue_job_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue', 'job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});
register.registerMetric(queueJobDuration);

const queueDepth = new client.Gauge({
  name: 'jubileeverse_queue_depth',
  help: 'Current number of jobs waiting in queue',
  labelNames: ['queue', 'state']
});
register.registerMetric(queueDepth);

// WebSocket metrics
const websocketConnections = new client.Gauge({
  name: 'jubileeverse_websocket_connections',
  help: 'Current number of WebSocket connections'
});
register.registerMetric(websocketConnections);

const websocketMessagesTotal = new client.Counter({
  name: 'jubileeverse_websocket_messages_total',
  help: 'Total WebSocket messages sent/received',
  labelNames: ['direction', 'type']
});
register.registerMetric(websocketMessagesTotal);

// Cache metrics
const cacheOperationsTotal = new client.Counter({
  name: 'jubileeverse_cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result']
});
register.registerMetric(cacheOperationsTotal);

const cacheDuration = new client.Histogram({
  name: 'jubileeverse_cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25]
});
register.registerMetric(cacheDuration);

// Database metrics
const dbQueryDuration = new client.Histogram({
  name: 'jubileeverse_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5]
});
register.registerMetric(dbQueryDuration);

const dbConnectionsActive = new client.Gauge({
  name: 'jubileeverse_db_connections_active',
  help: 'Number of active database connections',
  labelNames: ['pool']
});
register.registerMetric(dbConnectionsActive);

// Authentication metrics
const authAttemptsTotal = new client.Counter({
  name: 'jubileeverse_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['method', 'result']
});
register.registerMetric(authAttemptsTotal);

const activeSessionsGauge = new client.Gauge({
  name: 'jubileeverse_active_sessions',
  help: 'Number of active user sessions'
});
register.registerMetric(activeSessionsGauge);

// Error metrics
const errorsTotal = new client.Counter({
  name: 'jubileeverse_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code']
});
register.registerMetric(errorsTotal);

// ============================================
// Metric Helper Functions
// ============================================

/**
 * Record HTTP request metrics
 */
function recordHttpRequest(method, route, statusCode, durationSeconds) {
  const labels = { method, route: normalizeRoute(route), status_code: statusCode };
  httpRequestTotal.inc(labels);
  httpRequestDuration.observe(labels, durationSeconds);
}

/**
 * Normalize route for consistent labeling
 */
function normalizeRoute(route) {
  if (!route) return 'unknown';
  // Replace dynamic segments with placeholders
  return route
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[^/]+\.(jpg|png|gif|css|js|svg|ico)/gi, '/:file');
}

/**
 * Record AI request metrics
 */
function recordAiRequest(personaId, status, isAsync, durationSeconds = null) {
  aiRequestsTotal.inc({ persona_id: personaId, status, async: isAsync ? 'true' : 'false' });
  if (durationSeconds !== null) {
    aiResponseDuration.observe({ persona_id: personaId, status }, durationSeconds);
  }
}

/**
 * Record queue job metrics
 */
function recordQueueJob(queue, status, jobType = null, durationSeconds = null) {
  queueJobsTotal.inc({ queue, status });
  if (durationSeconds !== null && jobType) {
    queueJobDuration.observe({ queue, job_type: jobType }, durationSeconds);
  }
}

/**
 * Update queue depth gauge
 */
function updateQueueDepth(queue, state, count) {
  queueDepth.set({ queue, state }, count);
}

/**
 * Record cache operation
 */
function recordCacheOperation(operation, result, durationSeconds = null) {
  cacheOperationsTotal.inc({ operation, result });
  if (durationSeconds !== null) {
    cacheDuration.observe({ operation }, durationSeconds);
  }
}

/**
 * Record database query
 */
function recordDbQuery(operation, table, durationSeconds) {
  dbQueryDuration.observe({ operation, table }, durationSeconds);
}

/**
 * Record error
 */
function recordError(type, code) {
  errorsTotal.inc({ type, code: String(code) });
}

/**
 * Record auth attempt
 */
function recordAuthAttempt(method, result) {
  authAttemptsTotal.inc({ method, result });
}

/**
 * Get metrics in Prometheus format
 */
async function getMetrics() {
  return register.metrics();
}

/**
 * Get content type for metrics
 */
function getContentType() {
  return register.contentType;
}

module.exports = {
  register,
  // Metric instances (for direct access if needed)
  httpRequestDuration,
  httpRequestTotal,
  httpRequestsInProgress,
  aiResponseDuration,
  aiRequestsTotal,
  conversationsActive,
  queueJobsTotal,
  queueJobDuration,
  queueDepth,
  websocketConnections,
  websocketMessagesTotal,
  cacheOperationsTotal,
  cacheDuration,
  dbQueryDuration,
  dbConnectionsActive,
  authAttemptsTotal,
  activeSessionsGauge,
  errorsTotal,
  // Helper functions
  recordHttpRequest,
  recordAiRequest,
  recordQueueJob,
  updateQueueDepth,
  recordCacheOperation,
  recordDbQuery,
  recordError,
  recordAuthAttempt,
  getMetrics,
  getContentType
};
