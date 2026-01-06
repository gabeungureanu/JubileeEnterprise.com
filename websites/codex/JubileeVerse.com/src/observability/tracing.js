/**
 * Request Tracing
 * Provides distributed tracing capabilities for request tracking
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Header names for trace propagation
const TRACE_HEADERS = {
  TRACE_ID: 'x-trace-id',
  SPAN_ID: 'x-span-id',
  PARENT_SPAN_ID: 'x-parent-span-id',
  REQUEST_ID: 'x-request-id'
};

/**
 * Generate a new trace ID
 */
function generateTraceId() {
  return uuidv4().replace(/-/g, '');
}

/**
 * Generate a new span ID
 */
function generateSpanId() {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}

/**
 * Extract trace context from incoming request
 */
function extractTraceContext(req) {
  return {
    traceId: req.headers[TRACE_HEADERS.TRACE_ID] || generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: req.headers[TRACE_HEADERS.SPAN_ID] || null,
    requestId: req.headers[TRACE_HEADERS.REQUEST_ID] || generateTraceId().substring(0, 8)
  };
}

/**
 * Inject trace context into outgoing request headers
 */
function injectTraceContext(headers, context) {
  return {
    ...headers,
    [TRACE_HEADERS.TRACE_ID]: context.traceId,
    [TRACE_HEADERS.SPAN_ID]: context.spanId,
    [TRACE_HEADERS.PARENT_SPAN_ID]: context.parentSpanId,
    [TRACE_HEADERS.REQUEST_ID]: context.requestId
  };
}

/**
 * Create a child span context
 */
function createChildSpan(parentContext, name) {
  return {
    traceId: parentContext.traceId,
    spanId: generateSpanId(),
    parentSpanId: parentContext.spanId,
    requestId: parentContext.requestId,
    name,
    startTime: Date.now()
  };
}

/**
 * Tracing middleware
 * Attaches trace context to every request
 */
function tracingMiddleware(req, res, next) {
  // Extract or create trace context
  const context = extractTraceContext(req);

  // Attach to request object
  req.trace = {
    ...context,
    startTime: Date.now(),
    spans: []
  };

  // Add trace ID to response headers
  res.setHeader(TRACE_HEADERS.TRACE_ID, context.traceId);
  res.setHeader(TRACE_HEADERS.REQUEST_ID, context.requestId);

  // Create span helper on request
  req.startSpan = (name) => {
    const span = createChildSpan(req.trace, name);
    req.trace.spans.push(span);
    return {
      end: (metadata = {}) => {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.metadata = metadata;

        logger.debug('Span completed', {
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          name: span.name,
          duration: span.duration,
          ...metadata
        });
      }
    };
  };

  // Log request start with trace context
  logger.debug('Request started', {
    traceId: context.traceId,
    requestId: context.requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  next();
}

/**
 * Create trace context for async operations (queues, background jobs)
 */
function createAsyncTraceContext(parentContext = null) {
  if (parentContext) {
    return createChildSpan(parentContext, 'async-operation');
  }

  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: null,
    requestId: generateTraceId().substring(0, 8),
    startTime: Date.now()
  };
}

/**
 * Serialize trace context for queue job data
 */
function serializeTraceContext(context) {
  return {
    traceId: context.traceId,
    spanId: context.spanId,
    parentSpanId: context.parentSpanId,
    requestId: context.requestId
  };
}

/**
 * Deserialize trace context from queue job data
 */
function deserializeTraceContext(data) {
  if (!data || !data.traceId) {
    return createAsyncTraceContext();
  }

  return {
    traceId: data.traceId,
    spanId: generateSpanId(),
    parentSpanId: data.spanId,
    requestId: data.requestId,
    startTime: Date.now()
  };
}

module.exports = {
  TRACE_HEADERS,
  generateTraceId,
  generateSpanId,
  extractTraceContext,
  injectTraceContext,
  createChildSpan,
  tracingMiddleware,
  createAsyncTraceContext,
  serializeTraceContext,
  deserializeTraceContext
};
