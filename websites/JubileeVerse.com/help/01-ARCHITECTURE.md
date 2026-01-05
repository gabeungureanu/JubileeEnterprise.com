# System Architecture

## Overview

JubileeVerse follows a **layered architecture** with clear separation of concerns. The system is designed for horizontal scalability, handling 1M+ daily visitors through asynchronous processing, caching, and container orchestration.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                             │
│                    (NGINX Ingress / Traefik)                     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                     Application Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Pod 1     │  │   Pod 2     │  │   Pod N     │   (HPA)      │
│  │  Express.js │  │  Express.js │  │  Express.js │              │
│  │  + WebSocket│  │  + WebSocket│  │  + WebSocket│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                      Service Layer                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AuthService │ PersonaService │ ConversationService │ ...│   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │     Redis       │    │     Qdrant      │
│   (Primary DB)  │    │ (Cache/Queue)   │    │  (Vector DB)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Architectural Decisions

### 1. Why Express.js?

**Decision:** Use Express.js as the web framework.

**Rationale:**
- Mature, well-documented, large ecosystem
- Minimal overhead, high performance
- Middleware architecture allows modular security/logging
- Easy integration with WebSocket (ws library)
- Team familiarity and hiring pool

**Trade-offs:**
- Less opinionated than frameworks like NestJS
- Manual organization of code structure required

### 2. Why Separate PostgreSQL and Qdrant?

**Decision:** Use PostgreSQL for relational data, Qdrant for vector embeddings.

**Rationale:**
- PostgreSQL excels at ACID transactions, joins, user data
- Qdrant optimized for semantic search (persona knowledge, context retrieval)
- Separation of concerns: each database does what it's best at
- Qdrant can be scaled independently for AI workloads

**Trade-offs:**
- Two databases to maintain
- Need to keep data synchronized for some operations

### 3. Why Redis for Everything?

**Decision:** Use Redis for sessions, caching, and job queues.

**Rationale:**
- Single infrastructure component for multiple purposes
- Sessions: Enables horizontal scaling (shared session store)
- Caching: Sub-millisecond response times for repeated queries
- Queues: BullMQ provides reliable job processing with retries
- Pub/Sub: Could enable cross-pod WebSocket message broadcasting

**Trade-offs:**
- Redis becomes a critical dependency
- Need Redis Cluster or Sentinel for production HA

### 4. Why Asynchronous AI Processing?

**Decision:** Queue AI requests through BullMQ, deliver via WebSocket.

**Rationale:**
- AI responses take 2-30 seconds; blocking HTTP is poor UX
- Queuing prevents server overload during traffic spikes
- Priority queues enable paid user prioritization
- Retries handle transient AI provider failures
- WebSocket provides real-time updates and streaming potential

**Trade-offs:**
- More complex than synchronous requests
- Requires WebSocket connection management
- Need fallback for clients without WebSocket support

### 5. Why MVC with Services?

**Decision:** Extend MVC with a dedicated Service layer.

**Rationale:**
- Controllers stay thin (HTTP handling only)
- Services contain business logic (reusable, testable)
- Models define data structures and database operations
- Clear boundaries for unit testing

**Trade-offs:**
- More files than simple MVC
- Need discipline to avoid putting logic in wrong layer

## Component Responsibilities

### Controllers (`src/controllers/`)
- Parse HTTP requests
- Validate input (basic)
- Call appropriate services
- Format HTTP responses
- Handle authentication checks

**Do NOT:** Contain business logic, database queries, or AI calls.

### Services (`src/services/`)
- Implement business logic
- Orchestrate multiple model operations
- Handle AI provider integration
- Implement caching strategies
- Transform data between layers

**Do NOT:** Handle HTTP, sessions, or response formatting.

### Models (`src/models/`)
- Define data structures
- Implement database queries
- Handle data validation
- Manage relationships

**Do NOT:** Contain business logic or call other services.

### Middleware (`src/middleware/`)
- Cross-cutting concerns (auth, logging, rate limiting)
- Request/response transformation
- Error handling

### Queue (`src/queue/`)
- Job definition and processing
- WebSocket real-time communication
- Background task management

### Cache (`src/cache/`)
- Redis connection management
- Caching strategies (TTL, invalidation)
- Session storage

## Data Flow Examples

### Synchronous Chat Request

```
1. Client POST /chat/conversations/:id/messages
2. Express routing → ChatController.sendMessage
3. Controller validates session, extracts params
4. Controller calls ConversationService.addMessage
5. Service calls Persona.findById (cached)
6. Service calls OpenAI/Anthropic API
7. Service calls ConversationService.addMessage (save response)
8. Controller returns JSON response
9. Client displays message
```

### Asynchronous Chat Request

```
1. Client POST /chat/conversations/:id/messages/async
2. Controller saves user message
3. Controller calls AIResponseProcessor.queueAIResponse
4. BullMQ adds job to Redis queue
5. Controller returns 202 Accepted with requestId
6. Client connects to WebSocket with userId

--- Background Processing ---

7. Worker picks up job from queue
8. Worker calls PersonaService.generateResponse
9. Worker saves assistant message
10. Worker calls WebSocketService.sendToUser
11. Client receives message via WebSocket
```

## Scaling Strategy

### Horizontal Scaling

The application is stateless by design:
- Sessions stored in Redis (not memory)
- No local file storage
- Database connections pooled
- WebSocket state in Redis (for pub/sub)

Kubernetes HPA scales pods based on:
- CPU utilization (70% threshold)
- Memory utilization (80% threshold)
- Custom metrics (queue depth, request rate)

### Vertical Scaling Points

| Component | Scale When | How |
|-----------|------------|-----|
| App Pods | CPU > 70% | HPA adds replicas |
| PostgreSQL | Query latency > 100ms | Read replicas, connection pooling |
| Redis | Memory > 80% | Redis Cluster, increase maxmemory |
| Qdrant | Search latency > 500ms | Add nodes to cluster |
| AI Queue | Depth > 100 | Add more workers (concurrency) |

## Security Architecture

```
Internet → WAF → Load Balancer → App
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
      Rate Limiting          Helmet.js
      (express-rate-limit)   (HTTP headers)
            │                     │
            └──────────┬──────────┘
                       ▼
               Session Validation
               (express-session + Redis)
                       │
                       ▼
               Route Authorization
               (requireAuth, requireAdmin)
                       │
                       ▼
               Input Validation
               (Controller level)
```

### Security Layers

1. **WAF/CDN** (External): DDoS protection, bot filtering
2. **Rate Limiting**: 100 requests/15min per IP
3. **Helmet**: Secure HTTP headers (CSP, HSTS, etc.)
4. **Session**: Signed cookies, Redis-backed
5. **Authorization**: Role-based access control
6. **Input Validation**: Per-endpoint validation

## Failure Modes and Recovery

| Failure | Impact | Recovery |
|---------|--------|----------|
| Single pod crash | Minimal (others handle traffic) | K8s restarts pod |
| Redis down | Sessions lost, cache cold | Graceful degradation, reconnect |
| PostgreSQL down | Read/write failures | Connection retry, failover |
| AI provider down | Chat responses fail | Queue retries, fallback provider |
| Qdrant down | Semantic search fails | Fallback to keyword search |

## AI Provider Integration

JubileeVerse supports multiple AI providers with automatic failover:

### Supported Providers

| Provider | Use Case | API Style |
|----------|----------|-----------|
| **OpenAI** | Primary chat, translations | OpenAI API |
| **Anthropic Claude** | Alternative conversations | Anthropic API |
| **xAI Grok** | Experimental features | OpenAI-compatible |

### Failover Strategy

1. Primary OpenAI key used for all requests
2. On quota exceeded (429), falls back to backup OpenAI key
3. Claude and Grok available for specific personas/features

### Health Monitoring

Admin dashboard shows real-time provider status:
- Uses lightweight `/models` endpoint (no tokens consumed)
- Polls hourly when healthy, every 5 minutes on errors
- Visual indicators: green (healthy), red (error)

**Endpoint:** `GET /api/admin/ai/status`

## Translation System

The platform supports 50+ languages with intelligent translation:

### Architecture

```
User Request → TranslationController → TranslationService
                                            ↓
                              Check ui_translations cache
                                            ↓
                              Cache miss? → OpenAI translate
                                            ↓
                              Save to ui_translations
                                            ↓
                              Return translated text
```

### Key Features

- **Persona name preservation**: Names are transliterated, not translated
- **Database caching**: Translations stored in `ui_translations` table
- **Backup key failover**: Uses secondary OpenAI key when primary exhausted

**Endpoint:** `GET /translation/placeholder?persona={slug}&language={code}`

## Future Architecture Considerations

1. **Event Sourcing**: For audit trails and conversation history
2. **CQRS**: Separate read/write models if query patterns diverge
3. **GraphQL**: If frontend needs flexible querying
4. **Service Mesh**: For advanced traffic management (Istio/Linkerd)
5. **Multi-region**: For global low-latency access
