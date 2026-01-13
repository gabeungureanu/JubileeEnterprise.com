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
- **Semantic Search**: Vector-based content search
- **AI-Powered Queries**: Natural language query processing
- **Collection Management**: Organized vector collections

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
- `POST /api/v1/rag/search` - Semantic search
- `GET /api/v1/rag/status` - RAG service status

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

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=inspire_content

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

## Technology Stack

- Node.js with Express
- PostgreSQL (via `pg` driver)
- Qdrant for vector search
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
