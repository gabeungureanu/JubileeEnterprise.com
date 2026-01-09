# JubileeVerse

> Faith-based AI chat platform with persona-aware conversational experiences

**Version**: 8.0.0
**Server**: solarwinding (10.0.0.4)

---

## Quick Start

### Prerequisites
- Windows Server
- Docker Desktop
- Node.js 18+

### One-Command Setup

```powershell
.\scripts\quick-start.ps1
```

This will:
1. ✓ Check Docker is running
2. ✓ Create/start production containers
3. ✓ Install Node.js dependencies
4. ✓ Run database migrations
5. ✓ Display ready-to-start summary

### Manual Setup

1. **Install Docker** (if needed):
   ```powershell
   .\scripts\install-docker-windows.ps1
   ```

2. **Set up containers**:
   ```powershell
   .\scripts\setup-production-containers.ps1
   ```

3. **Install dependencies**:
   ```powershell
   npm install
   ```

4. **Run migrations**:
   ```powershell
   npm run db:setup
   ```

5. **Start application**:
   ```powershell
   npm start
   ```

---

## Production Containers

| Service | Container Name | Port | Access |
|---------|---------------|------|--------|
| PostgreSQL | `JubileeVerse-postgres` | 5432 | Database: `JubileeVerse` |
| Qdrant | `JubileeVerse-qdrant` | 6333 | http://localhost:6333/dashboard |
| Redis | `JubileeVerse-redis` | 6379 | CLI: `docker exec -it JubileeVerse-redis redis-cli` |

---

## Tech Stack

- **Runtime**: Node.js 18+, Express.js
- **Databases**: PostgreSQL 16, Qdrant (vector), Redis 7
- **AI Providers**: OpenAI GPT-4, Anthropic Claude, xAI Grok
- **Queue**: BullMQ
- **WebSocket**: Real-time communication
- **Monitoring**: Prometheus, Grafana
- **Container**: Docker

---

## Project Structure

```
JubileeVerse.com/
├── src/
│   ├── controllers/     # HTTP request handlers (11 files)
│   ├── services/        # Business logic (27 files)
│   ├── models/          # Data models (25 files)
│   ├── routes/          # API endpoints (12 files)
│   ├── middleware/      # Security, sessions, errors
│   ├── queue/           # Background jobs, WebSocket
│   ├── cache/           # Redis caching
│   ├── database/        # DB connections
│   ├── utils/           # Utilities (logger, serverDetection)
│   └── config/          # Configuration
├── views/               # EJS templates (30+ pages)
├── website/             # Static assets (CSS, JS, images)
├── public/              # Public files
├── scripts/             # Utility scripts
├── migrations/          # Database migrations (92 files)
├── tests/               # Unit, integration, E2E tests
├── docs/                # Documentation
├── k8s/                 # Kubernetes configs
└── monitoring/          # Prometheus/Grafana configs
```

---

## Available Scripts

```powershell
# Development
npm run dev              # Start with auto-reload
npm start                # Start production mode

# Database
npm run db:setup         # Run all migrations
npm run db:migrate       # Run pending migrations
npm run db:seed          # Seed data
npm run db:reset         # Reset database

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests
npm run test:ci          # CI mode with coverage

# Linting
npm run lint             # Check code
npm run lint:fix         # Fix issues
```

---

## Server Detection

The application automatically detects when running on production server:

```javascript
const { isProductionServer, getServerInfo } = require('./src/utils/serverDetection');

if (isProductionServer()) {
  console.log('Running on production: solarwinding (10.0.0.4)');
}
```

---

## Key Features

### AI Chat System
- 25+ Biblical personas (scholars, counselors, teachers)
- Multi-provider AI with automatic failover
- Asynchronous processing via BullMQ
- Real-time responses via WebSocket
- Token usage tracking

### Translation Support
- 50+ languages
- Bible translation workflows
- UI string translation
- Persona name preservation
- Smart caching in PostgreSQL

### Engagement Tracking (Hospitality)
- Event-based user scoring
- Rule engine for popups/actions
- Visitor → Subscriber funnel
- Admin dashboard for metrics

### Community Features
- Discussion boards
- Community groups
- Member management
- Private conversations

### Subscriptions
- Multi-user token pools
- Tiered plans
- Team invitations
- Usage pooling

---

## Database

**Name**: `JubileeVerse`
**Migrations**: 92 total
**Key Tables**: users, personas, conversations, messages, communities, discussion_boards, hospitality_events, admin_tasks

**Access**:
```powershell
docker exec -it JubileeVerse-postgres psql -U guardian -d JubileeVerse
```

---

## API Endpoints

### Authentication
```
POST /auth/login
POST /auth/register
GET  /auth/me
POST /auth/forgot-password
```

### Chat
```
GET  /chat/conversations
POST /chat/conversations
POST /chat/conversations/:id/messages
GET  /chat/mailbox/:type
```

### Personas
```
GET /personas/list
GET /personas/featured
GET /personas/:slug
```

### Admin
```
GET /api/admin/health
GET /api/admin/analytics/dashboard
GET /api/admin/tasks
GET /api/admin/queues
```

[See full API documentation in `/help` directory]

---

## Container Management

### View Status
```powershell
docker ps --filter "name=JubileeVerse"
```

### View Logs
```powershell
docker-compose -f docker-compose.production.yml logs -f
```

### Restart
```powershell
docker-compose -f docker-compose.production.yml restart
```

### Stop
```powershell
docker-compose -f docker-compose.production.yml stop
```

---

## Data Storage

All persistent data is stored at:
```
C:\Data\JubileeVerse.com\.datastore\
├── postgres\    # Database files
├── qdrant\      # Vector database
└── redis\       # Cache/queue data
```

### Backup
```powershell
# PostgreSQL backup
docker exec JubileeVerse-postgres pg_dump -U guardian JubileeVerse > backup.sql

# Full backup (stop containers first)
docker-compose -f docker-compose.production.yml stop
Copy-Item -Recurse "C:\Data\JubileeVerse.com\.datastore" "C:\Backups\backup-$(Get-Date -Format 'yyyy-MM-dd')"
docker-compose -f docker-compose.production.yml start
```

---

## Environment Variables

Configuration in `.env`:

```env
# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY_PRIMARY=sk-proj-...
OPENAI_API_KEY_BACKUP=sk-proj-...
GROK_API_KEY=xai-...

# Database
DB_NAME=JubileeVerse
DB_HOST=localhost
DB_PORT=5432
DB_USER=guardian
DB_PASSWORD=***

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=inspire_knowledge

# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

---

## Documentation

- [Production Setup Guide](PRODUCTION_SETUP.md) - Complete setup instructions
- [Architecture](help/01-ARCHITECTURE.md) - System design
- [MVC Implementation](help/02-MVC-IMPLEMENTATION.md) - Code patterns
- [Folder Structure](help/03-FOLDER-STRUCTURE.md) - File organization
- [Setup Guide](help/05-SETUP-GUIDE.md) - Deployment
- [Extension Guide](help/06-EXTENSION-GUIDE.md) - Adding features
- [Scaling](help/07-SCALING-INFRASTRUCTURE.md) - Performance tuning
- [Observability](help/08-OBSERVABILITY.md) - Monitoring

---

## Monitoring

### Health Checks
- **Liveness**: http://localhost:3000/api/admin/live
- **Readiness**: http://localhost:3000/api/admin/ready
- **Health**: http://localhost:3000/api/admin/health

### Metrics
- **Prometheus**: http://localhost:3000/metrics
- **Grafana**: Configure with dashboard in `monitoring/grafana-dashboard.json`

---

## Testing

Test coverage requirement: **70%**

```powershell
# Run all tests
npm test

# With coverage report
npm run test:ci

# Watch mode
npm run test:watch
```

---

## Troubleshooting

### Docker Issues
```powershell
# Restart Docker Desktop
# Check logs
docker-compose -f docker-compose.production.yml logs

# Recreate containers
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Database Connection
```powershell
# Test connection
docker exec JubileeVerse-postgres pg_isready -U guardian -d JubileeVerse

# Check logs
docker logs JubileeVerse-postgres
```

### Application Logs
```
logs/server.log
```

---

## Support

- **Issues**: Check `docs/TODO.md` for known issues
- **QA Tests**: `docs/QA-TESTS-REFERENCE.md`
- **Business Rules**: `docs/BUSINESS_RULES.md`

---

## License

ISC

---

## Authors

JubileeVerse Team

---

**Production Server**: solarwinding (10.0.0.4)
**Last Updated**: January 2026
