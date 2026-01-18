# Jubilee Solutions - Three-Database Architecture

This document describes the database architecture for Jubilee Solutions, consisting of three PostgreSQL databases with distinct ownership boundaries.

## Overview

The Jubilee platform uses a three-database architecture to enforce clear separation of concerns:

| Database | Purpose | API Service | Port |
|----------|---------|-------------|------|
| **Codex** | Canonical system of record | codex-api | 4001 |
| **Inspire** | Ministry content & conversations | inspire-api | 4002 |
| **Continuum** | User data & activity | continuum-api | 4003 |

## Database Ownership Boundaries

### Codex Database (The Canonical Source)

**Purpose:** Codex is the foundational, canonical system of record. It stores reference data that other databases may link to but must never duplicate.

**Ownership:**
- **User Identity**: All user authentication data, password hashes, email verification
- **Roles & Permissions**: Role definitions, permission assignments, access control
- **OAuth/SSO**: OAuth clients, refresh tokens, two-factor authentication
- **Persona Metadata**: Persona definitions, system prompts, personality traits
- **Platform Configuration**: Feature flags, platform settings, safety thresholds
- **Bible Book References**: Canonical book metadata (NOT verse text)
- **Audit Logs**: Security-critical audit trail

**Key Tables:**
```
users, roles, permissions, user_roles, role_permissions
oauth_clients, refresh_tokens, two_factor_methods
personas, persona_categories, persona_tags
feature_flags, platform_settings, safety_thresholds
bible_books, admin_tasks, audit_logs
```

**Principles:**
1. Other databases reference Codex entities by ID only
2. Never duplicate user identity data elsewhere
3. All authentication goes through Codex
4. Persona definitions are canonical; usage data lives elsewhere

---

### Inspire Database (Ministry Content)

**Purpose:** Inspire handles all ministry content and AI conversation data. It references Codex entities but owns the content itself.

**Ownership:**
- **Bible Versions & Text**: Full verse text, translations, search indices
- **Ministry Content**: Books, music, videos, sermons, devotionals
- **AI Conversations**: Chat sessions, message history, token usage
- **Collections**: User-curated content collections
- **Translations**: UI translations for internationalization
- **Content Analytics**: View counts, engagement metrics

**Key Tables:**
```
bible_versions, bible_verses
ministry_content, content_series, content_analytics
conversations, messages
collections, collection_categories, category_items
ui_translations
ai_usage_daily, persona_engagement_metrics
```

**Relationships to Codex:**
- `conversations.user_id` → references `codex.users.id`
- `conversations.persona_id` → references `codex.personas.id`
- `ministry_content.author_id` → references `codex.users.id`
- `bible_verses.book_code` → references `codex.bible_books.code`

**Principles:**
1. Stores actual content, not just references
2. Owns conversation history and message content
3. Links to Codex for user/persona identity
4. Manages its own analytics independently

---

### Continuum Database (User Data & Activity)

**Purpose:** Continuum stores all user-specific data beyond identity, including preferences, subscriptions, and social features.

**Ownership:**
- **User Settings**: Preferences, themes, notification settings
- **Sessions**: Extended session data (beyond OAuth tokens)
- **Subscriptions**: Plans, billing, payment methods, invoices
- **Communities**: Groups, discussion boards, conversations
- **Favorites**: User bookmarks across all content types
- **Domains**: Jubilee TLD registrations
- **Safety**: Content flags, admin alerts
- **Activity**: User action logging

**Key Tables:**
```
user_settings, user_sessions
subscription_plans, user_subscriptions, payment_methods, invoices
communities, community_members, discussion_boards
board_conversations, board_messages
user_favorites, jubilee_tlds, jubilee_domains
safety_flags, admin_alerts, user_activity
```

**Relationships to Other Databases:**
- `user_settings.user_id` → references `codex.users.id`
- `user_favorites.favorite_id` → may reference Codex personas or Inspire content
- `safety_flags.conversation_id` → references `inspire.conversations.id`

**Principles:**
1. Never stores identity/auth data (that's Codex)
2. Never stores content/conversations (that's Inspire)
3. Owns the user's relationship with the platform
4. Manages billing and subscription lifecycle

---

## Cross-Database References

When referencing entities across databases, follow these rules:

### ✅ Allowed
- Store foreign IDs (UUIDs) that reference another database
- Denormalize non-critical display data (e.g., cache persona name for display)
- Join data at the API layer, not database layer

### ❌ Not Allowed
- Foreign key constraints across databases (impossible anyway)
- Duplicating source-of-truth data
- Storing user identity data outside Codex
- Storing conversation content outside Inspire

### Example: Displaying a Conversation

When displaying a conversation list in the UI:

1. **Inspire API** returns conversation metadata including `persona_id`
2. **Frontend** can either:
   - Make a parallel request to Codex API for persona details, OR
   - Use cached/denormalized persona name stored with conversation
3. **Never** fetch user auth data from anywhere except Codex

---

## Environment Separation

Each database has strict environment isolation:

```
ENVIRONMENT         CODEX_HOST          INSPIRE_HOST        CONTINUUM_HOST
development         localhost:5432      localhost:5433      localhost:5434
staging             codex.stg.db        inspire.stg.db      continuum.stg.db
production          codex.prd.db        inspire.prd.db      continuum.prd.db
```

**Safety Features:**
- Connection functions validate environment before connecting
- Development credentials cannot access production databases
- Separate connection pools per database
- Production migrations require explicit `--production` flag

### Environment Variables

Database configuration is controlled via `.env` file (see `.env.example`):

```env
# Environment (development | staging | production)
NODE_ENV=development

# Codex Database (Port 5432)
DB_CODEX_HOST=localhost
DB_CODEX_PORT=5432
DB_CODEX_NAME=jubilee_codex
DB_CODEX_USER=jubilee
DB_CODEX_PASSWORD=jubilee_dev_codex
DB_CODEX_SSL=false
DB_CODEX_POOL_SIZE=5

# Inspire Database (Port 5433)
DB_INSPIRE_HOST=localhost
DB_INSPIRE_PORT=5433
DB_INSPIRE_NAME=jubilee_inspire
DB_INSPIRE_USER=jubilee
DB_INSPIRE_PASSWORD=jubilee_dev_inspire
DB_INSPIRE_SSL=false
DB_INSPIRE_POOL_SIZE=5

# Continuum Database (Port 5434)
DB_CONTINUUM_HOST=localhost
DB_CONTINUUM_PORT=5434
DB_CONTINUUM_NAME=jubilee_continuum
DB_CONTINUUM_USER=jubilee
DB_CONTINUUM_PASSWORD=jubilee_dev_continuum
DB_CONTINUUM_SSL=false
DB_CONTINUUM_POOL_SIZE=5
```

### Docker Development Setup

Start all databases with Docker Compose:

```bash
# Start infrastructure services (databases, Redis, Qdrant)
npm run docker:infra

# Or directly:
docker-compose -f infrastructure/docker/docker-compose.services.yml up -d
```

This starts:
- `jubilee-codex` - Codex PostgreSQL on port 5432
- `jubilee-inspire` - Inspire PostgreSQL on port 5433
- `jubilee-continuum` - Continuum PostgreSQL on port 5434
- `jubilee-redis` - Redis on port 6379
- `jubilee-qdrant` - Qdrant vector DB on port 6333
- `jubilee-pgadmin` - pgAdmin on port 8082
- `jubilee-mailhog` - Email testing on port 8025

---

## API Layer Architecture

Each database has a dedicated API service that is the ONLY way to access that database:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ JubileeVerse│    │ JubileeInt  │    │  Other      │
│   Website   │    │   Website   │    │  Websites   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                   │
       └────────────┬─────┴───────────────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Codex API   │ │ Inspire API │ │Continuum API│
│   :4001     │ │   :4002     │ │   :4003     │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Codex     │ │   Inspire   │ │  Continuum  │
│  Database   │ │  Database   │ │  Database   │
│   :5432     │ │   :5433     │ │   :5434     │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Rules:**
1. Websites MUST NOT access databases directly
2. Each API owns exactly one database
3. APIs may call other APIs for cross-database operations
4. Shared business logic lives in `@jubilee/database` package

---

## Database Migrations

### Migration Infrastructure

Migrations are the **single source of truth** for schema evolution. The migration system is located at:

```
infrastructure/migrations/
├── codex/                    # Codex database migrations
│   ├── 0001_initial_schema.sql
│   └── 0002_seed_default_data.sql
├── inspire/                  # Inspire database migrations
│   ├── 0001_initial_schema.sql
│   └── 0002_seed_default_data.sql
├── continuum/                # Continuum database migrations
│   ├── 0001_initial_schema.sql
│   └── 0002_seed_default_data.sql
├── runner/                   # Migration execution engine
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── cli.ts            # CLI commands
│       ├── config.ts         # Environment configuration
│       ├── migrator.ts       # Migration executor
│       └── index.ts
└── README.md                 # Detailed migration documentation
```

### Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migrate:codex` | Run pending Codex migrations |
| `npm run migrate:inspire` | Run pending Inspire migrations |
| `npm run migrate:continuum` | Run pending Continuum migrations |
| `npm run migrate:all` | Run all pending migrations (all databases) |
| `npm run migrate:status` | Show migration status for all databases |
| `npm run migrate:create <db> <name>` | Create a new migration file |
| `npm run migrate:verify` | Test database connections |

### Migration Naming Convention

All migration files must follow this format:

```
NNNN_descriptive_name.sql
```

- `NNNN` - Four-digit version number (0001, 0002, 0003...)
- `descriptive_name` - Snake_case description of the change
- `.sql` - SQL file extension

Examples:
```
0001_initial_schema.sql
0002_seed_default_data.sql
0003_add_user_preferences.sql
0004_create_audit_indexes.sql
```

### Migration Rules

#### 1. Append-Only Migrations

**NEVER modify an existing migration file once committed.**

- Fix a bug in a migration → Create a new migration with the fix
- Add a column → Create a new migration
- Change a constraint → Create a new migration to drop and recreate

#### 2. Database Isolation

Each database folder contains ONLY migrations for that database:
- `codex/` → Only Codex database changes
- `inspire/` → Only Inspire database changes
- `continuum/` → Only Continuum database changes

**NEVER reference or modify another database from within a migration.**

#### 3. Idempotent Design

Migrations must be safe to run multiple times:
```sql
-- Use IF NOT EXISTS for CREATE
CREATE TABLE IF NOT EXISTS users (...);

-- Use IF EXISTS for DROP
DROP TABLE IF EXISTS old_table;

-- Use ON CONFLICT for inserts
INSERT INTO roles (id, name) VALUES (...)
ON CONFLICT (id) DO NOTHING;
```

#### 4. Version Tracking

Each database maintains a `schema_migrations` table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    checksum VARCHAR(64)
);
```

### Production Safeguards

Production migrations require an explicit `--production` flag:

```bash
# Development (no flag needed)
npm run migrate:codex

# Production (flag required)
npm run migrate:codex -- --production
```

Without the flag, migrations to production will be blocked with a warning.

### Migration Frequency Guidelines

| Database | Change Rate | Review Level |
|----------|-------------|--------------|
| Codex | Rare | Requires senior review |
| Inspire | Moderate | Standard review |
| Continuum | Frequent | Standard review |

---

## Data Migration from World Wide Bible Web

### Migration Mapping

The existing World Wide Bible Web database is migrated as follows:

| Original Data | Target Database | Notes |
|---------------|-----------------|-------|
| Users, passwords | Codex | Core identity data |
| Bible books | Codex | Canonical reference only |
| Bible verses | Inspire | Full text with search |
| Personas | Codex | Definitions and prompts |
| Conversations | Inspire | All chat history |
| User preferences | Continuum | Settings and themes |

### Migration Script

A one-time migration script exists at:
```
packages/database/scripts/migrate-from-wwbw.ts
```

Run with:
```bash
npx tsx packages/database/scripts/migrate-from-wwbw.ts
```

**Prerequisites:**
- Source database (WWBW) must be accessible
- Target databases (Codex, Inspire, Continuum) must be initialized with migrations
- Environment variables must be configured

**Environment Variables for Migration:**
```env
WWBW_DATABASE_URL=postgresql://user:pass@localhost:5432/world_wide_bible_web
CODEX_DATABASE_URL=postgresql://jubilee:jubilee_dev_codex@localhost:5432/jubilee_codex
INSPIRE_DATABASE_URL=postgresql://jubilee:jubilee_dev_inspire@localhost:5433/jubilee_inspire
CONTINUUM_DATABASE_URL=postgresql://jubilee:jubilee_dev_continuum@localhost:5434/jubilee_continuum
```

---

## Quick Reference

### Which Database for What?

| I need to... | Use Database |
|--------------|--------------|
| Authenticate a user | Codex |
| Check user permissions | Codex |
| Get persona details | Codex |
| Check feature flag | Codex |
| Search Bible text | Inspire |
| Load conversation history | Inspire |
| Get ministry content | Inspire |
| Get user preferences | Continuum |
| Manage subscription | Continuum |
| Log user activity | Continuum |
| Check community membership | Continuum |

### API Endpoints Quick Reference

**Codex API (localhost:4001)**
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/:id/permissions` - Get user permissions
- `GET /api/personas` - List personas
- `GET /api/feature-flags/:name/enabled` - Check feature flag

**Inspire API (localhost:4002)**
- `GET /api/bible/:version/:book/:chapter` - Get Bible chapter
- `GET /api/users/:userId/conversations` - Get user conversations
- `POST /api/conversations/:id/messages` - Send message
- `GET /api/content` - List ministry content

**Continuum API (localhost:4003)**
- `GET /api/users/:userId/settings` - Get user settings
- `GET /api/users/:userId/subscription` - Get subscription
- `GET /api/communities` - List communities
- `POST /api/activity` - Log user activity
