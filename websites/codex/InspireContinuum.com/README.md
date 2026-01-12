# InspireContinuum API Server

Backend API service for the Continuum database, handling user activity tracking, chat logs, and high-volume data operations.

## Overview

InspireContinuum is logically and operationally distinct from InspireCodex to prevent high-volume traffic from destabilizing the foundational layer. All Continuum reads/writes go through this service and reference user identity using global user identifiers issued by Codex.

## Features

### Core APIs
- **Activity Sessions**: Track user sessions across devices and clients
- **Activity Events**: High-volume event tracking with batch support
- **Chat Conversations**: Store and manage chat conversations
- **Chat Messages**: Message storage with token tracking and reactions
- **User Content**: Personal content storage (notes, drafts, etc.)
- **User Annotations**: Highlights, bookmarks, and annotations
- **Reading Progress**: Track reading plan progress
- **Analytics Events**: Application analytics and telemetry

### Admin Dashboard
- **Real-time Dashboard**: User metrics, active sessions, and activity
- **Browser Session Tracking**: Jubilee Browser heartbeat integration
- **Session Management**: View and manage active sessions

### New in v1.1.0 (2026-01-11)
- **Heartbeat Endpoint**: `/api/v1/admin/heartbeat` for Jubilee Browser session tracking
- **Session End Endpoint**: `/api/v1/admin/session/end` for clean session termination
- **Dashboard UI**: Static HTML dashboard at root URL
- **Upsert Logic**: Proper conflict handling for browser sessions using unique index

## Port

- Default: `3101`
- Configurable via `PORT` environment variable

## API Endpoints

### Health & Status
- `GET /health` - Service health check
- `GET /api/v1/status` - API status with statistics

### Admin Dashboard
- `GET /api/v1/admin/dashboard` - Dashboard data (users, sessions, metrics)
- `POST /api/v1/admin/heartbeat` - Browser session heartbeat
- `POST /api/v1/admin/session/end` - End browser session

### Sessions
- `POST /api/v1/sessions` - Create activity session
- `GET /api/v1/sessions` - Get user sessions
- `PATCH /api/v1/sessions/:id/end` - End session

### Events
- `POST /api/v1/events` - Track single event
- `POST /api/v1/events/batch` - Batch track events

### Conversations
- `POST /api/v1/conversations` - Create conversation
- `GET /api/v1/conversations` - List user conversations
- `GET /api/v1/conversations/:id` - Get conversation
- `PATCH /api/v1/conversations/:id` - Update conversation

### Messages
- `POST /api/v1/conversations/:id/messages` - Add message
- `GET /api/v1/conversations/:id/messages` - Get messages
- `POST /api/v1/messages/:id/reactions` - Add reaction

### Content & Annotations
- `POST /api/v1/content` - Create user content
- `GET /api/v1/content` - Get user content
- `POST /api/v1/annotations` - Create annotation
- `GET /api/v1/annotations` - Get annotations

### Progress & Analytics
- `POST /api/v1/progress` - Track reading progress
- `GET /api/v1/progress` - Get progress
- `POST /api/v1/analytics` - Track analytics event

## Database

Connects to two PostgreSQL databases:
- **Continuum**: Primary database for activity and chat data (read/write)
- **Codex**: Identity database for user verification (read-only)

## Environment Variables

```env
# Server
PORT=3101
NODE_ENV=development

# Continuum Database
CONTINUUM_DB_HOST=localhost
CONTINUUM_DB_PORT=5432
CONTINUUM_DB_NAME=continuum
CONTINUUM_DB_USER=guardian
CONTINUUM_DB_PASSWORD=your_password

# Codex Database (identity lookup)
CODEX_DB_HOST=localhost
CODEX_DB_PORT=5432
CODEX_DB_NAME=codex
CODEX_DB_USER=guardian
CODEX_DB_PASSWORD=your_password

# CORS
CORS_ORIGINS=https://jubileebrowser.com,https://inspirecontinuum.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=200
```

## Running Locally

```bash
cd websites/codex/InspireContinuum.com
npm install
npm start
```

Or with PM2:
```bash
pm2 start server.js --name inspirecontinuum
```

## Technology Stack

- Node.js with Express
- PostgreSQL (via `pg` driver)
- Helmet for security headers
- Morgan for request logging
- Express Rate Limit
- UUID for session tokens

## License

Copyright 2024-2026 Jubilee Solutions
