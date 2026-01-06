# Observability

This document covers metrics, logging, tracing, and monitoring for JubileeVerse.

## Overview

Observability is built on three pillars:

1. **Metrics**: Numerical measurements (Prometheus)
2. **Logs**: Event records (Structured JSON)
3. **Traces**: Request flow tracking (Distributed tracing)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application                               │
├─────────────────────────────────────────────────────────────────┤
│   Metrics              Logs                 Traces               │
│   (/metrics)           (stdout)             (x-trace-id)         │
└────────┬───────────────────┬─────────────────────┬──────────────┘
         │                   │                     │
         ▼                   ▼                     ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐
│ Prometheus  │    │  Log        │    │  Trace Collector    │
│             │    │  Aggregator │    │  (Jaeger/Zipkin)    │
└──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘
       │                  │                      │
       ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Grafana                                  │
│                   (Unified Dashboard)                            │
└─────────────────────────────────────────────────────────────────┘
```

## Metrics (Prometheus)

### Accessing Metrics

```bash
# Metrics endpoint
curl http://localhost:3000/metrics

# Output (Prometheus format)
# HELP jubileeverse_http_requests_total Total number of HTTP requests
# TYPE jubileeverse_http_requests_total counter
jubileeverse_http_requests_total{method="GET",route="/api/personas",status_code="200"} 1523
```

### Custom Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | Histogram | method, route, status_code | Request latency |
| `http_requests_total` | Counter | method, route, status_code | Total requests |
| `http_requests_in_progress` | Gauge | method | Active requests |
| `ai_response_duration_seconds` | Histogram | persona_id, status | AI generation time |
| `ai_requests_total` | Counter | persona_id, status, async | AI requests |
| `queue_jobs_total` | Counter | queue, status | Queue jobs |
| `queue_depth` | Gauge | queue, state | Jobs waiting |
| `websocket_connections` | Gauge | - | WS connections |
| `cache_operations_total` | Counter | operation, result | Cache ops |
| `errors_total` | Counter | type, code | Error counts |

### Recording Metrics

```javascript
// src/observability/metrics.js

// Record HTTP request (called by middleware)
function recordHttpRequest(method, route, statusCode, durationSeconds) {
  httpRequestTotal.inc({ method, route, status_code: statusCode });
  httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);
}

// Record AI request
function recordAiRequest(personaId, status, isAsync, durationSeconds) {
  aiRequestsTotal.inc({ persona_id: personaId, status, async: isAsync ? 'true' : 'false' });
  if (durationSeconds !== null) {
    aiResponseDuration.observe({ persona_id: personaId, status }, durationSeconds);
  }
}

// Record error
function recordError(type, code) {
  errorsTotal.inc({ type, code: String(code) });
}
```

### Default Node.js Metrics

Automatically collected by `prom-client`:

- `nodejs_heap_size_used_bytes` - Heap memory used
- `nodejs_heap_size_total_bytes` - Total heap size
- `nodejs_external_memory_bytes` - External memory
- `nodejs_gc_duration_seconds` - GC duration
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `process_cpu_seconds_total` - CPU time
- `process_resident_memory_bytes` - RSS memory

## Structured Logging

### Log Format

**Production (JSON):**
```json
{
  "timestamp": "2024-12-21T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "service": "jubileeverse",
  "version": "8.0.0",
  "env": "production",
  "hostname": "pod-abc123",
  "traceId": "abc123def456",
  "requestId": "req-789",
  "method": "POST",
  "path": "/api/chat/messages",
  "statusCode": 200,
  "durationMs": 1523
}
```

**Development (Pretty):**
```
[2024-12-21T10:30:00.000Z] [INFO ] Request completed {"method":"POST","path":"/api/chat/messages"}
```

### Log Levels

| Level | When to Use |
|-------|-------------|
| `error` | Application errors, exceptions |
| `warn` | Recoverable issues, deprecations |
| `info` | Important events, request completion |
| `debug` | Detailed debugging (dev only) |

### Using the Logger

```javascript
const logger = require('../utils/logger');

// Basic logging
logger.info('User logged in', { userId: 'user-123' });
logger.error('Database connection failed', { error: err.message });

// Request-scoped logger (includes trace context)
const log = logger.forRequest(req);
log.info('Processing message', { conversationId: 'conv-456' });

// Child logger with default context
const serviceLogger = logger.child({ service: 'PersonaService' });
serviceLogger.info('Generating response', { personaId: 'persona-789' });
```

### Sensitive Data Redaction

```javascript
// Automatically redacted fields
const sensitiveKeys = [
  'password', 'secret', 'token', 'apiKey',
  'authorization', 'cookie', 'session'
];

// Input
logger.info('Auth attempt', { password: 'secret123', email: 'user@test.com' });

// Output
{"password":"[REDACTED]","email":"user@test.com"}
```

### Configuration

```bash
# Environment variables
LOG_LEVEL=info     # error, warn, info, debug
LOG_FORMAT=json    # json, pretty
```

## Distributed Tracing

### Trace Context

Every request gets a trace context:

```javascript
req.trace = {
  traceId: '550e8400e29b41d4a716446655440000',  // UUID, propagates across services
  spanId: '7b8c9d0e1f2a3b4c',                    // Current operation
  parentSpanId: null,                            // Parent span (if any)
  requestId: 'abc12345',                         // Short ID for logs
  startTime: 1703153400000                       // Request start
};
```

### Creating Spans

```javascript
// In controllers or services
const span = req.startSpan('generate-ai-response');

try {
  const response = await PersonaService.generateResponse(...);
  span.end({ personaId: response.persona.id });
} catch (error) {
  span.end({ error: error.message });
  throw error;
}
```

### Trace Propagation

Headers for cross-service tracing:

```javascript
// Incoming request headers
{
  'x-trace-id': '550e8400e29b41d4a716446655440000',
  'x-span-id': '7b8c9d0e1f2a3b4c',
  'x-request-id': 'abc12345'
}

// Outgoing request (to external service)
const headers = injectTraceContext(existingHeaders, req.trace);
await fetch('https://api.openai.com/...', { headers });
```

### Queue Tracing

```javascript
// When queuing a job
const jobData = {
  ...data,
  trace: serializeTraceContext(req.trace)
};

await queue.add('process', jobData);

// When processing the job
const trace = deserializeTraceContext(job.data.trace);
// Now logs in worker include traceId from original request
```

## Monitoring Stack

### Starting the Stack

```bash
# Full monitoring
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### Components

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| App | 3000 | http://localhost:3000 | - |
| Prometheus | 9090 | http://localhost:9090 | - |
| Grafana | 3001 | http://localhost:3001 | admin/jubilee123 |
| Alertmanager | 9093 | http://localhost:9093 | - |

### Grafana Dashboard

Pre-built dashboard includes:

1. **Overview Row**
   - Request rate (req/s)
   - P95 latency
   - Error rate
   - WebSocket connections

2. **HTTP Requests Row**
   - Request rate by route
   - Latency distribution (p50/p95/p99)

3. **AI & Queues Row**
   - AI request rate by status
   - Queue depth over time

4. **System Resources Row**
   - Node.js memory (heap)
   - GC duration, event loop lag

## Alerting

### Alert Rules

Located in `monitoring/alerts.yml`:

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | 5xx rate > 5% for 5min | critical |
| HighLatency | P95 > 2s for 5min | warning |
| CriticalLatency | P99 > 10s for 2min | critical |
| AIQueueBacklog | Queue depth > 50 for 5min | warning |
| SlowAIResponses | P95 > 30s for 5min | warning |
| HighMemoryUsage | Heap > 90% for 5min | warning |
| ServiceDown | Up = 0 for 1min | critical |

### Alert Configuration

```yaml
# monitoring/alertmanager.yml
route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'

  routes:
    - match:
        severity: critical
      receiver: 'critical'
      # Send immediately to PagerDuty/Slack
```

### Silencing Alerts

During maintenance:
```bash
# Via Alertmanager UI
http://localhost:9093/#/silences/new

# Or via API
curl -X POST http://localhost:9093/api/v2/silences -d '{
  "matchers": [{"name": "alertname", "value": ".*", "isRegex": true}],
  "startsAt": "2024-12-21T10:00:00.000Z",
  "endsAt": "2024-12-21T12:00:00.000Z",
  "createdBy": "admin",
  "comment": "Scheduled maintenance"
}'
```

## Health Checks

### Endpoints

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `/api/admin/live` | Liveness | Process running |
| `/api/admin/ready` | Readiness | Redis + DB connected |
| `/api/admin/health` | Full status | All dependencies |

### Response Examples

**Liveness (simple):**
```json
{"status":"alive","timestamp":1703153400000}
```

**Readiness:**
```json
{
  "status": "ready",
  "checks": {
    "redis": true,
    "database": true
  },
  "timestamp": 1703153400000
}
```

**Full Health:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-21T10:30:00.000Z",
  "uptime": 3600.5,
  "memory": {
    "heapUsed": 52428800,
    "heapTotal": 104857600,
    "rss": 157286400
  },
  "version": "8.0.0",
  "redis": {
    "connected": true,
    "mock": false
  },
  "database": {
    "connected": true
  },
  "websocket": {
    "totalConnections": 42,
    "uniqueUsers": 35
  }
}
```

## Debugging

### Enabling Debug Logs

```bash
# Local development
LOG_LEVEL=debug npm run dev

# In Kubernetes
kubectl -n jubileeverse set env deployment/jubileeverse-app LOG_LEVEL=debug
```

### Tracing Requests

```bash
# Find request by trace ID in logs
docker-compose logs app | grep "abc123def456"

# Or in Kubernetes
kubectl -n jubileeverse logs -l app=jubileeverse | grep "abc123def456"
```

### Prometheus Queries

```promql
# Request rate by route
sum(rate(jubileeverse_http_requests_total[5m])) by (route)

# Error rate
sum(rate(jubileeverse_http_requests_total{status_code=~"5.."}[5m]))
  /
sum(rate(jubileeverse_http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95, sum(rate(jubileeverse_http_request_duration_seconds_bucket[5m])) by (le))

# Queue depth over time
jubileeverse_queue_depth{queue="ai-response"}

# Memory usage percentage
jubileeverse_nodejs_heap_size_used_bytes / jubileeverse_nodejs_heap_size_total_bytes
```

### Common Issues

**High Latency:**
1. Check Prometheus: `histogram_quantile(0.95, ...)`
2. Look for slow routes
3. Check AI provider latency
4. Check database query times

**Memory Growth:**
1. Check `nodejs_heap_size_used_bytes`
2. Look for event loop lag
3. Check for memory leaks in long-running processes

**Queue Backlog:**
1. Check `jubileeverse_queue_depth`
2. Increase worker concurrency
3. Check AI provider rate limits
4. Scale horizontally
