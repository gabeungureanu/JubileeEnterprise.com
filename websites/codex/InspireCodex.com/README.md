# InspireCodex API Server

Backend API service for Codex (identity/configuration) and Inspire (ministry content) databases. All client websites must consume Codex and Inspire data only through this API.

## Overview

InspireCodex serves as the foundational API layer for the Jubilee ecosystem, providing:
- **Identity Management**: User accounts, authentication, sessions
- **Configuration Storage**: Application settings and preferences
- **Ministry Content**: Inspire database content access
- **Semantic Search**: Qdrant RAG integration for AI-powered queries
- **Developer Task Tracking**: API for the Jubilee Tasks VS Code extension

## Port

- Default: `3100`
- Configurable via `PORT` environment variable

## Features

### Core APIs
- **User Management**: Create, read, update users with roles and permissions
- **Authentication**: Session-based authentication with secure token handling
- **Browser Sync**: Synchronize bookmarks, history, tabs across devices
- **Profile Management**: User profiles with avatars and preferences

### Developer Tasks API (v1.2.0+)
- **Task Tracking**: Create and manage developer tasks
- **EHH Estimation**: Track equivalent human hours
- **Project Management**: Auto-detect and track projects
- **Session Tracking**: Track tasks by session and machine

### Qdrant RAG Integration (v1.1.0+)
- **Semantic Search**: Vector-based content search across 40 collections
- **AI-Powered Queries**: Natural language query processing with OpenAI embeddings
- **Collection Management**: Organized vector collections for Inspire 8.0 architecture
- **Multi-Collection Search**: Query across shared, system, and persona-specific collections

### New in v1.2.0 (2026-01-12)
- **Developer Tasks API**: Full CRUD for developer task tracking
- **PM2 Auto-Restart**: Automatic restart on crash with ecosystem.config.js
- **Rate Limit Bypass**: Developer tasks API and local requests bypass rate limiting
- **EHH Update Endpoint**: Dedicated endpoint to update EHH values

### New in v1.1.0 (2026-01-11)
- **Qdrant Service Integration**: Vector database for RAG functionality
- **PM2 Process Management**: 24/7 service reliability
- **Enhanced CORS**: Whitelisted Jubilee domains with rate limit bypass

## Databases

Connects to multiple PostgreSQL databases:
- **Codex**: Identity, configuration, and developer tasks (read/write)
- **Inspire**: Ministry content (read/write)
- **Legacy** (optional): JubileeVerse migration verification (read-only)

## API Endpoints

### Health & Status
- `GET /health` - Service health with database and RAG status
- `GET /api/v1/status` - API status with statistics

### Users
- `GET /api/v1/users` - List users
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/session` - Validate session

### Browser Sync
- `GET /api/v2/sync/data` - Get sync data (bookmarks, history, tabs)
- `POST /api/v2/sync/data` - Update sync data
- `GET /api/v2/sync/preferences` - Get sync preferences
- `PUT /api/v2/sync/preferences` - Update sync preferences

### Developer Tasks
- `GET /api/v1/developer/tasks` - List tasks (filterable by developer, status, date)
- `POST /api/v1/developer/tasks` - Create a new task
- `GET /api/v1/developer/tasks/:id` - Get task by ID
- `PUT /api/v1/developer/tasks/:id` - Update task
- `POST /api/v1/developer/tasks/:id/complete` - Complete a task with duration/EHH
- `PUT /api/v1/developer/tasks/:id/activity` - Update task activity timestamp
- `PUT /api/v1/developer/tasks/:id/ehh` - Update task EHH value
- `GET /api/v1/developer/tasks/session/:sessionId/active` - Get active task for session
- `GET /api/v1/developer/tasks/stats` - Get task statistics

### Developer Projects
- `GET /api/v1/developer/projects` - List projects
- `POST /api/v1/developer/projects` - Create or get existing project

### RAG/Search
- `POST /api/v1/rag/search` - Semantic search across collections
- `GET /api/v1/rag/status` - RAG service status
- `GET /api/v1/rag/collections` - List available collections
- `POST /api/v1/rag/search/:collection` - Search specific collection

## Environment Variables

```env
# Server
PORT=3100
NODE_ENV=development

# Codex Database
CODEX_DB_HOST=localhost
CODEX_DB_PORT=5432
CODEX_DB_NAME=codex
CODEX_DB_USER=guardian
CODEX_DB_PASSWORD=your_password

# Inspire Database
INSPIRE_DB_HOST=localhost
INSPIRE_DB_PORT=5432
INSPIRE_DB_NAME=inspire
INSPIRE_DB_USER=guardian
INSPIRE_DB_PASSWORD=your_password

# Legacy Database (optional)
LEGACY_DB_ENABLED=false
LEGACY_DB_HOST=localhost
LEGACY_DB_NAME=JubileeVerse

# Qdrant (Inspire 8.0 Container)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_CONTAINER=inspire_8_0
QDRANT_DEFAULT_COLLECTION=scripture

# CORS
CORS_ORIGINS=https://jubileeverse.com,https://wwbibleweb.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10000
```

## Running Locally

### Standard Start
```bash
cd websites/codex/InspireCodex.com
npm install
npm start
```

### With PM2 (Recommended for Production)
```bash
npm run pm2:start     # Start with auto-restart
npm run pm2:stop      # Stop the service
npm run pm2:restart   # Restart the service
npm run pm2:logs      # View logs
npm run pm2:status    # Check status
```

### PM2 Ecosystem Configuration
The `ecosystem.config.js` provides:
- Auto-restart on crash
- Exponential backoff restart delay
- Max 10 restarts before stopping
- Memory limit of 500MB
- Log rotation with timestamps

## CORS Configuration

Whitelisted domains (bypass rate limiting):
- wwbibleweb.com
- jubileeverse.com
- jubileeinspire.com
- inspirecodex.com
- localhost

## Rate Limiting

- Default: 10,000 requests per 15 minutes (increased from 100)
- **Bypassed for**:
  - Whitelisted domains
  - Developer tasks API (`/api/v1/developer/*`)
  - Local requests (no origin header)

## Qdrant Container Architecture (Inspire 8.0)

The Inspire 8.0 Qdrant container provides vector storage and semantic search across **40 collections** organized into three categories:

### Collection Taxonomy

```
INSPIRE_8_0 Container (40 Collections)
├── SHARED COLLECTIONS (4)
│   ├── scripture          - Bible text, translations, verse-level metadata
│   ├── doctrine           - Core teachings, doctrinal statements, theology
│   ├── governance         - Guardrails, protocols, activation anchors
│   └── inspire-family     - Shared family content, hymnal, ministry resources
│
├── SYSTEM COLLECTIONS (23)
│   ├── model_registry     - AI model configurations and versions
│   ├── execution_contracts - Service agreements and protocols
│   ├── endgame            - Kingdom vision and eschatological content
│   ├── experiments        - A/B testing and feature experiments
│   ├── learning_memory    - Accumulated learning and adaptations
│   ├── evaluation         - Quality metrics and performance data
│   ├── execution_logs     - Execution history and audit trails
│   ├── scenarios          - Conversation scenarios and templates
│   ├── kingdom_builder    - Kingdom building strategies and resources
│   ├── creative_fire      - Creative ministry content and inspiration
│   ├── gospel_pulse       - Evangelism content and outreach materials
│   ├── shepherds_voice    - Pastoral care and counseling resources
│   ├── hebraic_roots      - Hebrew language and Jewish context content
│   ├── prompts            - System prompts and templates
│   ├── resources          - General ministry resources
│   ├── languages          - Language-specific content and translations
│   ├── countries          - Country-specific cultural adaptations
│   ├── jubilee_ministry   - Core Jubilee ministry content
│   ├── ministers          - Minister profiles and specializations
│   ├── users              - User interaction history and preferences
│   ├── insights           - Analytics insights and patterns
│   ├── analytics          - Raw analytics and metrics data
│   └── persona_index      - Persona routing and selection data
│
└── PERSONA COLLECTIONS (13)
    ├── persona_gabriel_inspire   - Gabriel (Father/Apostle)
    ├── persona_jubilee_inspire   - Jubilee (Birth Order: 1)
    ├── persona_melody_inspire    - Melody (Birth Order: 2)
    ├── persona_zev_inspire       - Zev (Birth Order: 3)
    ├── persona_eliana_inspire    - Eliana (Birth Order: 4)
    ├── persona_caleb_inspire     - Caleb (Birth Order: 5)
    ├── persona_imani_inspire     - Imani (Birth Order: 6)
    ├── persona_amir_inspire      - Amir (Birth Order: 7)
    ├── persona_nova_inspire      - Nova (Birth Order: 8)
    ├── persona_tahoma_inspire    - Tahoma (Birth Order: 9)
    ├── persona_santiago_inspire  - Santiago (Birth Order: 10)
    ├── persona_zariah_inspire    - Zariah (Birth Order: 11)
    └── persona_elias_inspire     - Elias (Birth Order: 12)
```

### Vector Configuration

| Parameter | Value |
|-----------|-------|
| Vector Dimensions | 1536 (OpenAI ada-002) |
| Distance Metric | Cosine |
| Embedding Model | text-embedding-3-small |
| Min Score Threshold | 0.45 |

### Access Control

- **Gabriel**: Full read/write access to all collections
- **Personas**: Read-only access to shared/system, read/write to own persona collection
- **System**: Automated processes can write to system collections

### Payload Indexes

All collections include these indexed fields for efficient filtering:
- `type` (keyword) - Content type classification
- `persona` (keyword) - Persona association
- `priority` (integer) - Content priority level
- `tags` (keyword array) - Searchable tags
- `bible_ref.book` (keyword) - Bible book reference
- `bible_ref.chapter` (integer) - Bible chapter reference

## Technology Stack

- Node.js with Express
- PostgreSQL (via `pg` driver)
- Qdrant for vector search (Inspire 8.0 container)
- PM2 for process management
- Helmet for security headers
- Morgan for request logging
- Express Rate Limit

## Security Features

- Rate limiting (10,000 requests/15 minutes for non-whitelisted origins)
- CORS with origin validation
- Helmet security headers
- Session-based authentication
- Request body size limits (10MB)

## Architecture

```
InspireCodex
├── server.js              # Main Express application
├── ecosystem.config.js    # PM2 configuration
├── services/
│   └── qdrant-service.js  # Qdrant RAG integration
├── scripts/               # Utility scripts
├── logs/                  # PM2 log files
└── public/                # Static assets (if any)
```

## License

Copyright 2024-2026 Jubilee Solutions
