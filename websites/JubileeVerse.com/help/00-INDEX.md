# JubileeVerse Internal Documentation

Welcome to the JubileeVerse developer documentation. This directory contains comprehensive guides for understanding, running, and extending the platform.

## Documentation Files

| File | Description |
|------|-------------|
| [01-ARCHITECTURE.md](01-ARCHITECTURE.md) | System architecture, design decisions, and component overview |
| [02-MVC-IMPLEMENTATION.md](02-MVC-IMPLEMENTATION.md) | Model-View-Controller pattern implementation details |
| [03-FOLDER-STRUCTURE.md](03-FOLDER-STRUCTURE.md) | Complete file and directory layout with explanations |
| [04-FRONTEND-BACKEND.md](04-FRONTEND-BACKEND.md) | Frontend-backend separation and API design |
| [05-SETUP-GUIDE.md](05-SETUP-GUIDE.md) | Local development and production deployment |
| [06-EXTENSION-GUIDE.md](06-EXTENSION-GUIDE.md) | How to add features without breaking existing code |
| [07-SCALING-INFRASTRUCTURE.md](07-SCALING-INFRASTRUCTURE.md) | Queue system, caching, and Kubernetes scaling |
| [08-OBSERVABILITY.md](08-OBSERVABILITY.md) | Metrics, logging, tracing, and monitoring |

## Quick Links

- **New Developer?** Start with [01-ARCHITECTURE.md](01-ARCHITECTURE.md) then [05-SETUP-GUIDE.md](05-SETUP-GUIDE.md)
- **Adding a Feature?** Read [06-EXTENSION-GUIDE.md](06-EXTENSION-GUIDE.md)
- **Debugging?** Check [08-OBSERVABILITY.md](08-OBSERVABILITY.md)
- **Deploying?** See [05-SETUP-GUIDE.md](05-SETUP-GUIDE.md) and [07-SCALING-INFRASTRUCTURE.md](07-SCALING-INFRASTRUCTURE.md)

## Platform Overview

JubileeVerse is a faith-based AI chat platform that provides:
- Conversational AI with Biblical personas (scholars, counselors, prayer guides)
- Multi-language support with translation capabilities
- Real-time chat via WebSocket
- Scalable architecture supporting 1M+ daily visitors

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Runtime** | Node.js 20+, Express.js |
| **Databases** | PostgreSQL (relational), Qdrant (vector) |
| **Caching** | Redis (sessions, cache, queues) |
| **AI** | OpenAI GPT-4, Anthropic Claude, xAI Grok |
| **Queue** | BullMQ with Redis backend |
| **Monitoring** | Prometheus, Grafana |
| **Container** | Docker, Kubernetes |

## Recent Features (December 2024)

### AI Provider Status Monitoring
The admin dashboard displays real-time health status for all AI providers:
- **OpenAI** - Primary AI provider with backup key failover
- **Claude (Anthropic)** - Secondary AI provider
- **Grok (xAI)** - Third AI provider option

Health checks use lightweight `/models` endpoint calls (no token consumption) and poll hourly when healthy, or every 5 minutes when errors detected.

**Admin endpoint:** `GET /api/admin/ai/status`

### UI Translation System
Dynamic translation of UI strings with persona name preservation:
- Translates search placeholders and UI text to 50+ languages
- Keeps persona names intact (transliterates instead of translates)
- Caches translations in PostgreSQL `ui_translations` table
- Uses backup OpenAI key when primary quota exceeded

**API endpoint:** `GET /translation/placeholder?persona={slug}&language={code}`

**Database table:** `ui_translations` (Migration: 026_ui_translations.sql)

| Column | Purpose |
|--------|---------|
| string_key | UI element identifier (e.g., 'search_placeholder') |
| persona_slug | Persona the string relates to |
| target_language | ISO language code |
| translated_text | Cached translation |

## Version

- **Current Version:** 8.0.0
- **Last Updated:** December 2024
