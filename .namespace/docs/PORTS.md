# Jubilee Solutions - Port Assignments

This document defines the port assignments for all Jubilee Solutions projects.
Each service runs on a unique port to enable simultaneous local development.

## Website Services

| Service | Port | Package Name | Description |
|---------|------|--------------|-------------|
| **Launcher** | 3000 | @jubilee/launcher | Development navigation hub |
| **JubileeBrowser.com** | 3002 | @jubilee/browser-site | Marketing website for Jubilee Browser |
| **JubileeInspire.com** | 3003 | @jubilee/inspire | AI Bible Chat Interface |
| **JubileeIntelligence.com** | 3004 | @jubilee/intelligence | AI Content Generation System |
| **JubileeInternet.com** | 3005 | @jubilee/internet | SSO & Identity Services |
| **JubileePersonas.com** | 3006 | @jubilee/personas | AI Persona Management |
| **JubileeVerse.com** | 3007 | @jubilee/verse | Faith-based AI Chat Platform |
| **JubileeWebsites.com** | 3008 | @jubilee/websites-generator | AI Website Generation |

## API Services (Three-Database Architecture)

| Service | Port | Package Name | Description |
|---------|------|--------------|-------------|
| **Codex API** | 4001 | @jubilee/codex-api | Identity, SSO, platform configuration |
| **Inspire API** | 4002 | @jubilee/inspire-api | Ministry content, conversations, collections |
| **Continuum API** | 4003 | @jubilee/continuum-api | User data, activity, subscriptions |

## Database Services (Three-Database Architecture)

| Service | Port | Database Name | Description |
|---------|------|---------------|-------------|
| **PostgreSQL (Codex)** | 5432 | jubilee_codex | Identity & canonical system of record |
| **PostgreSQL (Inspire)** | 5433 | jubilee_inspire | Ministry content & conversations |
| **PostgreSQL (Continuum)** | 5434 | jubilee_continuum | User data & activity |

## Infrastructure Services (Development)

| Service | Port | Description |
|---------|------|-------------|
| **Redis** | 6379 | Cache and session storage |
| **Qdrant** | 6333 | Vector database for AI embeddings |
| **Qdrant gRPC** | 6334 | Qdrant gRPC interface |
| **Mailhog SMTP** | 1025 | Email testing (SMTP) |
| **Mailhog UI** | 8025 | Email testing (Web UI) |
| **Redis Commander** | 8081 | Redis management UI |
| **pgAdmin** | 8082 | PostgreSQL management UI |

## Desktop Applications

| Application | Description |
|-------------|-------------|
| **JubileeBrowser.WPF** | Windows Desktop Browser (.NET/WPF) |

## Quick Reference

```bash
# Start infrastructure services (databases, Redis, etc.)
npm run docker:infra

# Start all API services
npm run dev:apis           # Ports 4001, 4002, 4003

# Start individual API services
npm run dev:codex-api      # Port 4001 - Identity & SSO
npm run dev:inspire-api    # Port 4002 - Content & Conversations
npm run dev:continuum-api  # Port 4003 - User Data & Activity

# Start individual websites
npm run dev:verse          # Port 3007
npm run dev:internet       # Port 3005
npm run dev:intelligence   # Port 3004
npm run dev:personas       # Port 3006
npm run dev:websites       # Port 3008
npm run dev:browser-site   # Port 3002

# Start the launcher (development dashboard)
npm run launcher           # Port 3000

# Database migrations
npm run migrate:all        # Run all pending migrations
npm run migrate:codex      # Migrate Codex database only
npm run migrate:inspire    # Migrate Inspire database only
npm run migrate:continuum  # Migrate Continuum database only
npm run migrate:status     # Check migration status
npm run migrate:create codex add_user_preferences  # Create new migration
```

## Port Ranges

- **3000-3099**: Jubilee website services
- **4001-4099**: API services (Codex, Inspire, Continuum)
- **5432-5434**: PostgreSQL databases (Codex, Inspire, Continuum)
- **6333-6334**: Qdrant vector database
- **6379**: Redis cache
- **8025-8099**: Development tools

## Adding New Services

When adding a new website, assign the next available port in the 3000-3099 range.
Update this document and the launcher service accordingly.
