# JubileeEnterprise.com - Quick Reference Cheatsheet

> Fast lookup for ports, commands, and key information

---

## Port Assignments

### Databases
| Database | Port | Purpose |
|----------|------|---------|
| Codex (PostgreSQL) | 5432 | Identity, auth, RBAC |
| Inspire (PostgreSQL) | 5433 | Content, conversations |
| Continuum (PostgreSQL) | 5434 | User data, settings |
| Redis | 6379 | Cache, sessions |
| Qdrant | 6333 | Vector embeddings |

### APIs
| API | Port |
|-----|------|
| Codex API | 4001 |
| Inspire API | 4002 |
| Continuum API | 4003 |

### Websites
| Website | Port |
|---------|------|
| Launcher | 3000 |
| JubileeBrowser.com | 3002 |
| JubileeInspire.com | 3003 |
| JubileeIntelligence.com | 3004 |
| JubileeInternet.com | 3005 |
| JubileePersonas.com | 3006 |
| JubileeVerse.com | 3007 |
| JubileeWebsites.com | 3008 |

### Dev Tools
| Tool | Port |
|------|------|
| Mailhog | 8025 |
| Redis Commander | 8081 |
| pgAdmin | 5050 |

---

## Common Commands

```bash
# Infrastructure
npm run docker:infra           # Start Docker services
npm run docker:infra:down      # Stop Docker services

# Database
npm run migrate:all            # All migrations
npm run migrate:codex          # Codex only
npm run migrate:inspire        # Inspire only
npm run migrate:continuum      # Continuum only
npm run migrate:status         # Check status

# Development
npm run dev:apis               # All APIs
npm run dev:verse              # Main app (JubileeVerse)
npm run dev:internet           # SSO/Identity
npm run launcher               # Dev hub

# Build & Test
npm run build:all              # Build everything
npm run build:packages         # Shared packages only
npm run test                   # Run tests
npm run lint:fix               # Lint and auto-fix

# Desktop App
cd applications/JubileeBrowser.wpf
dotnet build                   # Build
dotnet run                     # Run
dotnet publish -c Release      # Publish
```

---

## Project Structure

```
JubileeEnterprise.com/
├── packages/           # @jubilee/shared, database, config
├── services/           # codex-api, inspire-api, continuum-api
├── websites/
│   ├── launcher/       # Development navigation hub
│   └── codex/          # Production websites (JubileeVerse, JubileeInspire, etc.)
├── applications/       # JubileeBrowser.wpf
├── infrastructure/     # docker, migrations, nginx
└── docs/              # Documentation
```

---

## Database Responsibilities

| Database | Stores |
|----------|--------|
| **Codex** | Users, roles, permissions, OAuth, personas (metadata), audit logs |
| **Inspire** | Bible verses, conversations, messages, ministry content, analytics |
| **Continuum** | Settings, subscriptions, communities, favorites, domains, activity |

---

## Key Files

| File | Purpose |
|------|---------|
| `.env` | Environment config |
| `package.json` | Workspace definition |
| `docker-compose.services.yml` | Docker services |
| `tsconfig.base.json` | TypeScript config |
| `PORTS.md` | Port reference |

---

## Technology Stack

- **Backend:** Node.js 20+, TypeScript 5.5+, Hono/Express
- **Database:** PostgreSQL 16, Redis 7, Qdrant
- **AI:** OpenAI, Anthropic Claude, Qdrant vectors
- **Desktop:** .NET 8, WPF, WebView2
- **Security:** JWT, bcrypt, RBAC, OAuth2

---

## Full Setup (New Environment)

```bash
# 1. Environment
cp .env.example .env
# Edit .env with credentials

# 2. Dependencies
npm install

# 3. Infrastructure
npm run docker:infra

# 4. Database
npm run migrate:all

# 5. Build packages
npm run build:packages

# 6. Run
npm run dev:apis    # Terminal 1
npm run dev:verse   # Terminal 2
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port in use | Check `PORTS.md`, kill process on port |
| DB connection failed | Verify Docker running: `npm run docker:infra` |
| Migration error | Check `npm run migrate:status` |
| Build error | Run `npm run build:packages` first |

---

*See `PROJECT_ANALYSIS.md` for complete documentation*
