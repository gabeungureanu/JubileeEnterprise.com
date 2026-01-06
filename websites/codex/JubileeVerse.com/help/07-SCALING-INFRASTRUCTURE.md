# Scaling Infrastructure

This document covers the queue system, caching strategies, and Kubernetes scaling configuration.

## Queue System (BullMQ)

### Overview

The queue system handles asynchronous AI response generation, preventing server overload during traffic spikes.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│   Express   │───▶│  BullMQ     │
│   Request   │    │   Server    │    │   Queue     │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │◀───│  WebSocket  │◀───│   Worker    │
│   Response  │    │   Service   │    │  (Process)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Queue Names

| Queue | Purpose | Priority |
|-------|---------|----------|
| `ai-response` | AI response generation | 1-10 |
| `email` | Email sending | 5 |
| `analytics` | Analytics processing | 10 |
| `translation-review` | Translation review | 5 |

### Job Processing

```javascript
// Adding a job to the queue
const { AIResponseProcessor } = require('./src/queue');

await AIResponseProcessor.queueAIResponse({
  conversationId: 'conv-123',
  personaId: 'persona-456',
  messages: [...],
  userLanguage: 'en',
  userId: 'user-789'
}, {
  priority: 1  // High priority (1-10, lower = higher priority)
});
```

### Worker Configuration

```javascript
// src/queue/AIResponseProcessor.js
function initializeWorker(options = {}) {
  const workerOptions = {
    concurrency: options.concurrency || 10,  // Parallel jobs
    limiter: {
      max: options.rateLimit || 50,  // Max jobs per second
      duration: 1000
    }
  };

  return QueueManager.createWorker(
    QueueManager.QUEUE_NAMES.AI_RESPONSE,
    processAIResponseJob,
    workerOptions
  );
}
```

### Priority Queue

```javascript
// High priority for paid users
const priority = user.isPremium ? 1 : 5;

await AIResponseProcessor.queueAIResponse(data, { priority });
```

### Job Lifecycle

1. **Queued**: Job added to Redis queue
2. **Active**: Worker picks up job
3. **Completed**: Job finished successfully
4. **Failed**: Job failed (will retry)

### Retry Strategy

```javascript
// Default job options (QueueManager.js)
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000  // 1s, 2s, 4s
  },
  removeOnComplete: {
    count: 1000,     // Keep last 1000
    age: 24 * 3600   // Or 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600  // Keep failed for 7 days
  }
};
```

### Monitoring Queues

```javascript
// Get queue statistics
const stats = await QueueManager.getQueueStats('ai-response');
// { waiting: 5, active: 2, completed: 100, failed: 3, delayed: 0 }

// Pause queue during maintenance
await QueueManager.pauseQueue('ai-response');

// Resume queue
await QueueManager.resumeQueue('ai-response');

// Clean old jobs
await QueueManager.cleanQueue('ai-response', 3600000, 'completed');
```

## Caching (Redis)

### TTL Strategies

| Strategy | TTL | Use Case |
|----------|-----|----------|
| `VERY_SHORT` | 30s | Rate limiting counters |
| `SHORT` | 60s | API responses |
| `MEDIUM` | 5min | Persona lists |
| `LONG` | 1hr | Individual personas |
| `VERY_LONG` | 24hr | Categories, static data |

### Cache-Aside Pattern

```javascript
// src/cache/CacheService.js
async getOrSet(key, fallback, ttl = TTL.MEDIUM) {
  // Try cache first
  const cached = await this.get(key);
  if (cached !== null) {
    return cached;  // Cache hit
  }

  // Cache miss - execute fallback
  const value = await fallback();

  // Store in cache
  if (value !== null && value !== undefined) {
    await this.set(key, value, ttl);
  }

  return value;
}
```

### Usage Example

```javascript
// In PersonaService
const persona = await CacheService.getOrSet(
  `persona:${id}`,
  () => Persona.findById(id),
  CacheService.TTL.LONG
);
```

### Cache Invalidation

```javascript
// After update
await Persona.update(id, data);
await CacheService.del(`persona:${id}`);

// Pattern-based invalidation
await CacheService.delPattern('persona:*');
```

### Session Storage

Sessions are stored in Redis for horizontal scaling:

```javascript
// src/middleware/session.js
const RedisStore = require('connect-redis').default;

sessionConfig.store = new RedisStore({
  client: redisClient,
  prefix: 'jv:sess:',
  ttl: 86400  // 24 hours
});
```

## WebSocket (Real-Time)

### Connection Management

```javascript
// src/queue/WebSocketService.js

// User connections tracked by userId
const userConnections = new Map();

// All connections with metadata
const connections = new Map();
// {
//   connectionId: {
//     id, userId, ws, isAlive, connectedAt, subscriptions
//   }
// }
```

### Message Targeting

```javascript
// Send to specific user (all their connections)
WebSocketService.sendToUser(userId, {
  type: 'ai-response-complete',
  message: assistantMessage
});

// Send to channel subscribers
WebSocketService.sendToChannel('conversation:123', {
  type: 'new-message',
  message: newMessage
});

// Broadcast to all
WebSocketService.broadcast({
  type: 'admin-notice',
  message: 'Maintenance in 10 minutes'
});
```

### Heartbeat

```javascript
// Every 30 seconds, ping clients
setInterval(() => {
  for (const [connectionId, connection] of connections) {
    if (!connection.isAlive) {
      connection.ws.terminate();  // Dead connection
      continue;
    }
    connection.isAlive = false;
    connection.ws.ping();
  }
}, 30000);

// Client responds with pong
ws.on('pong', () => {
  connectionData.isAlive = true;
});
```

## Kubernetes Scaling

### Horizontal Pod Autoscaler

```yaml
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: jubileeverse-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: jubileeverse-app
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Scale-Up Behavior

```yaml
behavior:
  scaleUp:
    stabilizationWindowSeconds: 0   # Scale up immediately
    policies:
      - type: Percent
        value: 100                   # Double pods
        periodSeconds: 15
      - type: Pods
        value: 4                     # Or add 4 pods
        periodSeconds: 15
    selectPolicy: Max                # Use whichever is larger
```

### Scale-Down Behavior

```yaml
behavior:
  scaleDown:
    stabilizationWindowSeconds: 300  # Wait 5min before scale down
    policies:
      - type: Percent
        value: 10                     # Remove 10% of pods
        periodSeconds: 60
      - type: Pods
        value: 2                      # Or remove 2 pods
        periodSeconds: 60
    selectPolicy: Min                 # Use whichever is smaller
```

### Pod Disruption Budget

```yaml
# Ensure minimum availability during updates
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: jubileeverse
```

### Resource Requests/Limits

```yaml
# k8s/base/deployment.yaml
resources:
  requests:
    cpu: "250m"      # 0.25 CPU
    memory: "256Mi"  # 256MB RAM
  limits:
    cpu: "1000m"     # 1 CPU max
    memory: "512Mi"  # 512MB RAM max
```

### Pod Anti-Affinity

Spread pods across nodes/zones:

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: jubileeverse
          topologyKey: kubernetes.io/hostname

topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway
```

### Rolling Updates

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # Add 1 new pod before removing old
    maxUnavailable: 0  # Never have fewer than desired
```

## Load Testing

### Baseline Performance

Target capacity: **1 million visitors/day**

| Metric | Baseline | Peak |
|--------|----------|------|
| Requests/sec | 12 | 60+ |
| AI requests/sec | 2 | 10+ |
| Latency (p95) | <500ms | <2s |
| Error rate | <0.1% | <1% |

### Load Testing Tools

```bash
# Install k6
brew install k6  # or download from k6.io

# Run load test
k6 run scripts/load-test.js
```

### Sample Load Test

```javascript
// scripts/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Steady
    { duration: '2m', target: 200 },  // Spike
    { duration: '5m', target: 200 },  // Steady at spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.01'],    // <1% failure
  },
};

export default function () {
  // Health check
  const health = http.get('http://localhost:3000/api/admin/health');
  check(health, { 'health status 200': (r) => r.status === 200 });

  // Persona list
  const personas = http.get('http://localhost:3000/api/personas');
  check(personas, { 'personas status 200': (r) => r.status === 200 });

  sleep(1);
}
```

## Capacity Planning

### Single Pod Capacity

| Resource | Capacity |
|----------|----------|
| Concurrent HTTP | ~100 |
| WebSocket connections | ~1000 |
| AI jobs processing | ~10/sec |
| Memory usage | ~256MB |

### Scaling Calculation

```
Daily visitors: 1,000,000
Peak multiplier: 3x (during peak hours)
Average session: 10 requests

Peak requests/hour = 1,000,000 × 3 / 24 = 125,000
Peak requests/sec = 125,000 / 3600 = ~35 req/sec

With 100 req/sec per pod:
Minimum pods = 35 / 100 = 1 (but use 3 for HA)

For 10x headroom:
Maximum pods = 35 × 10 / 100 = 4 (but set to 50 for spikes)
```

### Infrastructure Costs (Estimated)

| Component | Spec | Monthly Cost |
|-----------|------|--------------|
| 3 App Pods | 1 vCPU, 512MB | ~$30 |
| PostgreSQL | 2 vCPU, 4GB | ~$50 |
| Redis | 1GB | ~$25 |
| Qdrant | 2 vCPU, 4GB | ~$40 |
| Load Balancer | - | ~$20 |
| **Total Base** | | **~$165/mo** |

*Scales with traffic via HPA.*
