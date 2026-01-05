# JubileeEnterprise.com - Complete Project Analysis

> **Document Created:** January 5, 2026
> **Purpose:** Comprehensive documentation for future reference and onboarding

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Three-Database Architecture](#three-database-architecture)
5. [API Services](#api-services)
6. [Website Projects](#website-projects)
7. [Desktop Application](#desktop-application)
8. [Shared Packages](#shared-packages)
9. [Infrastructure](#infrastructure)
10. [Database Schema Details](#database-schema-details)
11. [Development Workflow](#development-workflow)
12. [Port Assignments](#port-assignments)
13. [Key Configuration Files](#key-configuration-files)
14. [Dependencies Summary](#dependencies-summary)
15. [Security Features](#security-features)
16. [AI/ML Integration](#aiml-integration)
17. [Deployment](#deployment)
18. [Architecture Patterns](#architecture-patterns)
19. [Strengths & Considerations](#strengths--considerations)

---

## Executive Summary

**JubileeEnterprise.com** is a monorepo containing a comprehensive faith-based enterprise platform. It consists of:

- **3 API Services** (Codex, Inspire, Continuum)
- **8 Website Projects** (JubileeVerse, JubileeInternet, etc.)
- **1 Desktop Application** (JubileeBrowser.WPF)
- **3 Shared Packages** (@jubilee/shared, @jubilee/database, @jubilee/config)
- **3 PostgreSQL Databases** (Codex, Inspire, Continuum)

The platform provides faith-based AI chat, content management, user authentication, and a secure Windows browser with content filtering.

---

## Project Structure

```
JubileeEnterprise.com/
├── packages/                    # Shared packages
│   ├── shared/                  # Common utilities (@jubilee/shared)
│   ├── database/                # Database layer (@jubilee/database)
│   └── config/                  # Configuration (@jubilee/config)
│
├── services/                    # Backend API services
│   ├── codex-api/              # Identity, SSO, platform config (Port 4001)
│   ├── inspire-api/            # Ministry content & conversations (Port 4002)
│   └── continuum-api/          # User data & activity (Port 4003)
│
├── websites/                    # Website projects
│   ├── launcher/               # Dev navigation hub (Port 3000)
│   ├── JubileeBrowser.com/     # Marketing site (Port 3002)
│   ├── JubileeInspire.com/     # Coming soon (Port 3003)
│   ├── JubileeIntelligence.com/ # AI content generation (Port 3004)
│   ├── JubileeInternet.com/    # SSO & identity (Port 3005)
│   ├── JubileePersonas.com/    # AI persona management (Port 3006)
│   ├── JubileeVerse.com/       # Faith-based AI chat (Port 3007)
│   └── JubileeWebsites.com/    # AI website generation (Port 3008)
│
├── applications/                # Desktop applications
│   └── JubileeBrowser.wpf/      # Windows browser (.NET 8/WPF)
│       ├── App.xaml             # Application entry
│       ├── MainWindow.xaml      # Main UI
│       ├── database/            # SQL scripts for content filtering
│       └── JubileeBrowser.csproj
│
├── infrastructure/              # Shared infrastructure
│   ├── docker/                 # Docker Compose files
│   ├── migrations/             # Database migrations
│   │   ├── codex/              # Codex DB migrations
│   │   ├── inspire/            # Inspire DB migrations
│   │   └── continuum/          # Continuum DB migrations
│   ├── nginx/                  # Nginx configuration
│   └── scripts/                # Infrastructure scripts
│
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # Architecture overview
│   ├── DEVELOPMENT.md          # Development guide
│   ├── MIGRATION_GUIDE.md      # Database migration guide
│   └── PROJECT_ANALYSIS.md     # This document
│
├── package.json                # Root workspace configuration
├── tsconfig.base.json          # Base TypeScript config
├── docker-compose.services.yml # Infrastructure services
├── .env.example                # Environment template
├── PORTS.md                    # Port assignments
└── README.md                   # Project overview
```

---

## Technology Stack

### Backend/Runtime
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| TypeScript | 5.5+ | Type-safe JavaScript |
| Hono | 4.5 | Lightweight API framework |
| Express.js | 4.18 | Web framework for websites |

### Databases
| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 16 | Relational database (3 instances) |
| Redis | 7 | Caching and sessions |
| Qdrant | Latest | Vector database for AI embeddings |

### AI/ML
| Technology | Purpose |
|------------|---------|
| OpenAI SDK | GPT integration |
| Anthropic SDK | Claude AI integration |
| Qdrant Client | Vector similarity search |

### Desktop (.NET)
| Technology | Version | Purpose |
|------------|---------|---------|
| .NET | 8.0 | Framework |
| WPF | - | UI framework |
| WebView2 | - | Browser rendering engine |
| Npgsql | 8.0.3 | PostgreSQL connector |

### Security
| Technology | Purpose |
|------------|---------|
| jose | JWT handling |
| bcrypt | Password hashing |
| helmet | Security headers |
| express-rate-limit | Rate limiting |

### Testing
| Technology | Purpose |
|------------|---------|
| Jest | Unit/integration testing |
| Vitest | Fast TypeScript testing |
| ESLint | Code linting |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Service orchestration |
| Kubernetes | Container orchestration |
| Nginx | Reverse proxy |

---

## Three-Database Architecture

The platform uses three separate PostgreSQL databases, each with a dedicated purpose:

### Codex Database (Port 5432)
**Purpose:** Canonical system of record for identity and platform configuration

**Key Responsibilities:**
- User authentication and authorization
- OAuth2/OIDC implementation
- Role and permission management (RBAC)
- Persona metadata management
- Platform configuration and feature flags
- Audit logging
- Bible reference data (book names, not verses)

**Key Tables:**
- `users` - User accounts with password hashes
- `roles`, `permissions`, `user_roles`, `role_permissions` - RBAC system
- `oauth_clients`, `refresh_tokens` - OAuth/SSO
- `personas`, `persona_categories`, `persona_tags` - Persona definitions
- `feature_flags`, `platform_settings` - Platform configuration
- `bible_books` - Canonical book references
- `audit_logs` - Security audit trail
- `two_factor_methods` - 2FA configuration

### Inspire Database (Port 5433)
**Purpose:** Ministry content, AI conversations, and engagement

**Key Responsibilities:**
- Bible versions and verse text management
- AI conversations and chat history
- Ministry content (books, music, videos, sermons)
- User collections and categories
- UI translations
- Content analytics

**Key Tables:**
- `bible_versions`, `bible_verses` - Full verse text and translations
- `conversations`, `messages` - Chat history with AI personas
- `ministry_content`, `content_series` - Books, music, videos, sermons
- `collections`, `collection_categories` - User content curation
- `ui_translations` - Internationalization
- `content_analytics`, `ai_usage_daily` - Usage metrics
- `persona_engagement_metrics` - Persona interaction data

### Continuum Database (Port 5434)
**Purpose:** User data, activity, preferences, and billing

**Key Responsibilities:**
- User settings and preferences
- Session management
- Subscription and billing
- Communities and discussion boards
- User favorites and bookmarks
- Domain registrations (Jubilee TLDs)
- Safety flags and moderation
- Activity logging

**Key Tables:**
- `user_settings` - Preferences, themes, notifications
- `user_sessions` - Extended session data
- `subscription_plans`, `user_subscriptions` - Billing and plans
- `payment_methods`, `invoices` - Payment information
- `communities`, `community_members`, `discussion_boards` - Social features
- `board_conversations`, `board_messages` - Discussion content
- `user_favorites` - Bookmarks across content types
- `jubilee_tlds`, `jubilee_domains` - Domain registrations
- `safety_flags`, `admin_alerts` - Content moderation
- `user_activity` - User action logging

### Cross-Database Communication Rules
1. Websites/apps communicate ONLY through APIs (never direct DB access)
2. APIs may call other APIs for cross-database operations
3. User IDs are consistent across all three databases
4. Codex is the source of truth for user identity

---

## API Services

### Codex API (Port 4001)
**Location:** `services/codex-api/`

**Endpoints:**
- `/auth/*` - Authentication (login, logout, register)
- `/users/*` - User management
- `/roles/*` - Role management
- `/permissions/*` - Permission management
- `/oauth/*` - OAuth2/OIDC
- `/personas/*` - Persona metadata
- `/platform/*` - Platform settings
- `/audit/*` - Audit logs

### Inspire API (Port 4002)
**Location:** `services/inspire-api/`

**Endpoints:**
- `/bible/*` - Bible versions and verses
- `/conversations/*` - AI chat conversations
- `/messages/*` - Chat messages
- `/content/*` - Ministry content
- `/collections/*` - User collections
- `/analytics/*` - Content analytics
- `/translations/*` - UI translations

### Continuum API (Port 4003)
**Location:** `services/continuum-api/`

**Endpoints:**
- `/settings/*` - User settings
- `/sessions/*` - Session management
- `/subscriptions/*` - Subscription management
- `/communities/*` - Community features
- `/favorites/*` - User favorites
- `/domains/*` - Domain registrations
- `/activity/*` - Activity logging
- `/moderation/*` - Safety and moderation

---

## Website Projects

| Website | Port | Directory | Purpose |
|---------|------|-----------|---------|
| Launcher | 3000 | `websites/launcher/` | Development navigation hub |
| JubileeBrowser.com | 3002 | `websites/JubileeBrowser.com/` | Marketing/landing page |
| JubileeInspire.com | 3003 | `websites/JubileeInspire.com/` | Coming soon placeholder |
| JubileeIntelligence.com | 3004 | `websites/JubileeIntelligence.com/` | AI content generation with Qdrant |
| JubileeInternet.com | 3005 | `websites/JubileeInternet.com/` | SSO & identity services |
| JubileePersonas.com | 3006 | `websites/JubileePersonas.com/` | AI persona management |
| JubileeVerse.com | 3007 | `websites/JubileeVerse.com/` | Faith-based AI chat (main app) |
| JubileeWebsites.com | 3008 | `websites/JubileeWebsites.com/` | AI website generation |

### JubileeVerse.com (Main Application)
The primary application - a faith-based AI chat platform featuring:
- AI persona conversations
- Scripture integration
- User authentication via JubileeInternet
- Content collections
- Community features

---

## Desktop Application

### JubileeBrowser.WPF (v8.0.6)
**Location:** `applications/JubileeBrowser.wpf/`

**Technology:**
- .NET 8.0
- WPF (Windows Presentation Foundation)
- WebView2 (Microsoft Edge rendering)
- Npgsql (PostgreSQL)

**Features:**

#### Dual-Mode Navigation
1. **Internet Mode** - Public web access with content filtering
2. **Jubilee Bible Mode** - Access to JubileeVerse and Scripture content

#### Security Features
- Built-in content filtering with 309,000+ blocked sites
- Session isolation between modes
- Secure WebView2 rendering
- No direct database access (API-only)

#### Enterprise Deployment
- MSI installer for Group Policy deployment
- Self-contained (includes .NET 8 runtime)
- Per-machine installation for all users
- Windows x64 only

**Key Files:**
- `App.xaml` / `App.xaml.cs` - Application entry point
- `MainWindow.xaml` / `MainWindow.xaml.cs` - Main browser window
- `JubileeBrowser.csproj` - Project configuration
- `database/*.sql` - Content filtering SQL scripts

---

## Shared Packages

### @jubilee/shared
**Location:** `packages/shared/`

**Provides:**
- Authentication utilities (JWT, token validation)
- Configuration management
- Error handling (JubileeError, ValidationError)
- HTTP response helpers
- Logging (Pino integration)
- Zod validation schemas
- Shared TypeScript types

### @jubilee/database
**Location:** `packages/database/`

**Provides:**
- Connection pooling for three databases
- Query builders for Codex, Inspire, Continuum
- Migration infrastructure
- Shared database types and interfaces
- Transaction management

### @jubilee/config
**Location:** `packages/config/`

**Provides:**
- Environment-specific settings
- Service discovery
- Database configuration
- Feature flag management

---

## Infrastructure

### Docker Services (`docker-compose.services.yml`)

```yaml
Services:
  - postgres-codex (Port 5432)
  - postgres-inspire (Port 5433)
  - postgres-continuum (Port 5434)
  - redis (Port 6379)
  - qdrant (Port 6333)
  - mailhog (Port 8025 - email testing)
  - redis-commander (Port 8081 - Redis UI)
  - pgadmin (Port 5050 - PostgreSQL UI)
```

### Database Migrations
**Location:** `infrastructure/migrations/`

**Structure:**
```
migrations/
├── codex/
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_roles.sql
│   └── ...
├── inspire/
│   ├── 0001_initial_schema.sql
│   └── ...
└── continuum/
    ├── 0001_initial_schema.sql
    └── ...
```

**Naming Convention:** `NNNN_descriptive_name.sql`

**Rules:**
- Append-only (never modify existing migrations)
- Idempotent (safe to run multiple times)
- Environment-isolated
- Require explicit flag for production

**Commands:**
```bash
npm run migrate:codex       # Run Codex migrations
npm run migrate:inspire     # Run Inspire migrations
npm run migrate:continuum   # Run Continuum migrations
npm run migrate:all         # Run all migrations
npm run migrate:status      # Check migration status
npm run migrate:create <db> <name>  # Create new migration
```

---

## Database Schema Details

### Codex Database Schema

```sql
-- Core user table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RBAC tables
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- OAuth tables
CREATE TABLE oauth_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    redirect_uris TEXT[] NOT NULL,
    grant_types TEXT[] DEFAULT ARRAY['authorization_code'],
    scopes TEXT[] DEFAULT ARRAY['openid', 'profile', 'email'],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Persona metadata (definitions only, not engagement)
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    avatar_url TEXT,
    category_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logging
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Inspire Database Schema

```sql
-- Bible content
CREATE TABLE bible_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bible_verses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID REFERENCES bible_versions(id),
    book VARCHAR(50) NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    UNIQUE(version_id, book, chapter, verse)
);

-- AI Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    persona_id UUID NOT NULL,
    title VARCHAR(255),
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ministry content
CREATE TABLE ministry_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- 'book', 'music', 'video', 'sermon'
    title VARCHAR(255) NOT NULL,
    author VARCHAR(100),
    description TEXT,
    content_url TEXT,
    thumbnail_url TEXT,
    metadata JSONB,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics
CREATE TABLE content_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID,
    content_type VARCHAR(50),
    views INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE,
    UNIQUE(content_id, date)
);

CREATE TABLE ai_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    messages_sent INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);
```

### Continuum Database Schema

```sql
-- User settings
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    theme VARCHAR(20) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'en',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_digest VARCHAR(20) DEFAULT 'weekly',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    features JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communities
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE community_members (
    community_id UUID REFERENCES communities(id),
    user_id UUID NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);

CREATE TABLE discussion_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites/Bookmarks
CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    item_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_type, item_id)
);

-- Domain registrations
CREATE TABLE jubilee_tlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tld VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE jubilee_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tld_id UUID REFERENCES jubilee_tlds(id),
    name VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logging
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation
CREATE TABLE safety_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    flagged_by UUID,
    reason VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Development Workflow

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- Visual Studio 2022 (for WPF development)
- .NET 8 SDK (for WPF development)

### Getting Started

```bash
# 1. Clone the repository
git clone <repository-url>
cd JubileeEnterprise.com

# 2. Copy environment file
cp .env.example .env
# Edit .env with your configuration

# 3. Install dependencies
npm install

# 4. Start infrastructure services
npm run docker:infra

# 5. Run database migrations
npm run migrate:all

# 6. Build shared packages
npm run build:packages

# 7. Start development servers
npm run dev:apis        # Start all API services
npm run dev:verse       # Start JubileeVerse website
# Or use launcher for navigation
npm run launcher
```

### NPM Scripts (Root)

```bash
# Development
npm run dev:verse              # Faith-based AI chat (3007)
npm run dev:internet           # SSO & identity (3005)
npm run dev:intelligence       # Content generation (3004)
npm run dev:personas           # Persona management (3006)
npm run dev:websites           # Website generator (3008)
npm run dev:browser-site       # Marketing site (3002)
npm run dev:codex-api          # Identity API (4001)
npm run dev:inspire-api        # Content API (4002)
npm run dev:continuum-api      # User data API (4003)
npm run dev:apis               # All APIs in parallel
npm run launcher               # Development hub (3000)

# Building
npm run build:all              # Build all projects
npm run build:packages         # Build shared packages

# Testing
npm run test                   # Test all workspaces
npm run test:coverage          # With coverage

# Linting
npm run lint                   # Lint all
npm run lint:fix               # Auto-fix issues

# Database
npm run migrate:all            # Run all migrations
npm run migrate:codex          # Codex only
npm run migrate:inspire        # Inspire only
npm run migrate:continuum      # Continuum only
npm run migrate:status         # Check status
npm run migrate:create <db> <name>  # Create new

# Infrastructure
npm run docker:infra           # Start services
npm run docker:infra:down      # Stop services
```

### Building JubileeBrowser (Desktop)

```bash
cd applications/JubileeBrowser.wpf

# Build
dotnet build

# Run
dotnet run

# Publish self-contained
dotnet publish -c Release -r win-x64 --self-contained
```

---

## Port Assignments

### Infrastructure Services
| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL (Codex) | 5432 | Identity database |
| PostgreSQL (Inspire) | 5433 | Content database |
| PostgreSQL (Continuum) | 5434 | User data database |
| Redis | 6379 | Cache and sessions |
| Qdrant | 6333 | Vector database |
| Mailhog UI | 8025 | Email testing |
| Redis Commander | 8081 | Redis management |
| pgAdmin | 5050 | PostgreSQL management |

### Website Projects
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

### API Services
| API | Port |
|-----|------|
| Codex API | 4001 |
| Inspire API | 4002 |
| Continuum API | 4003 |

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Root workspace definition |
| `.env.example` | Environment template |
| `.env` | Local environment (not committed) |
| `tsconfig.base.json` | Base TypeScript config |
| `docker-compose.services.yml` | Infrastructure services |
| `PORTS.md` | Port assignments reference |
| `README.md` | Project overview |
| `jubilee-solutions.code-workspace` | VS Code workspace |

### Environment Variables (.env)

```env
# Environment
NODE_ENV=development

# Codex Database (Identity)
CODEX_DB_HOST=localhost
CODEX_DB_PORT=5432
CODEX_DB_NAME=codex
CODEX_DB_USER=postgres
CODEX_DB_PASSWORD=your_password

# Inspire Database (Content)
INSPIRE_DB_HOST=localhost
INSPIRE_DB_PORT=5433
INSPIRE_DB_NAME=inspire
INSPIRE_DB_USER=postgres
INSPIRE_DB_PASSWORD=your_password

# Continuum Database (User Data)
CONTINUUM_DB_HOST=localhost
CONTINUUM_DB_PORT=5434
CONTINUUM_DB_NAME=continuum
CONTINUUM_DB_USER=postgres
CONTINUUM_DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# AI Services
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# API URLs
CODEX_API_URL=http://localhost:4001
INSPIRE_API_URL=http://localhost:4002
CONTINUUM_API_URL=http://localhost:4003
```

---

## Dependencies Summary

### Core Dependencies
```json
{
  "express": "4.18.2",
  "hono": "4.5.0",
  "@hono/node-server": "1.11.0",
  "pg": "8.11.3",
  "pg-pool": "3.6.1",
  "ioredis": "5.3.2",
  "zod": "3.23.8",
  "jose": "5.6.0",
  "bcrypt": "5.1.1",
  "pino": "9.0.0"
}
```

### AI/ML Dependencies
```json
{
  "@anthropic-ai/sdk": "0.71.2",
  "openai": "6.15.0",
  "@qdrant/js-client-rest": "1.7.0"
}
```

### Security Dependencies
```json
{
  "helmet": "7.1.0",
  "cors": "2.8.5",
  "express-rate-limit": "7.2.0",
  "express-session": "1.18.0",
  "connect-redis": "7.1.1"
}
```

### Development Dependencies
```json
{
  "typescript": "5.5.2",
  "tsx": "4.15.0",
  "jest": "29.7.0",
  "vitest": "1.6.0",
  "eslint": "8.57.0",
  "nodemon": "3.1.0"
}
```

### .NET Dependencies (JubileeBrowser)
```xml
<PackageReference Include="Npgsql" Version="8.0.3" />
<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
<PackageReference Include="Microsoft.Web.WebView2" Version="..." />
```

---

## Security Features

### Authentication & Authorization
- **JWT tokens** with short expiration (15min)
- **Refresh tokens** for session continuity
- **OAuth2/OIDC** support via Codex
- **Role-based access control (RBAC)**
- **Two-factor authentication (2FA)**

### Data Protection
- **Password hashing** with bcrypt
- **HTTPS enforcement** in production
- **Session isolation** in JubileeBrowser
- **Content filtering** (309,000+ blocked sites)

### API Security
- **Helmet** security headers
- **CORS** configuration
- **Rate limiting** per endpoint
- **Audit logging** for sensitive operations

### Infrastructure Security
- **Environment isolation** (dev/staging/prod)
- **Secrets management** via environment variables
- **Database connection pooling**
- **Redis for session storage**

---

## AI/ML Integration

### OpenAI Integration
- GPT-4 for conversational AI
- Content generation
- Scripture interpretation assistance

### Anthropic Claude Integration
- Alternative AI provider
- Content moderation
- Long-form content generation

### Qdrant Vector Database
- **Purpose:** Semantic similarity search
- **Used by:** JubileeIntelligence, JubileePersonas
- **Features:**
  - Content embeddings
  - Persona matching
  - Scripture similarity search
  - Content recommendations

### AI Personas
- Defined in Codex (metadata)
- Engagement tracked in Inspire (conversations)
- System prompts for Scripture-centered responses
- Category and tag organization

---

## Deployment

### Development Environment
- Local Docker services
- Hot-reload with nodemon/tsx
- Mailhog for email testing
- Redis Commander for cache inspection
- pgAdmin for database management

### Production Deployment

#### API Services
- Docker containerization
- Kubernetes orchestration (k8s manifests available)
- Load balancing via nginx
- Health check endpoints

#### Websites
- Static build outputs
- CDN distribution
- SSL/TLS termination

#### Desktop Application (JubileeBrowser)
- **Package type:** Self-contained .NET 8
- **Installer:** MSI for enterprise deployment
- **Distribution:** Per-machine installation
- **Requirements:** Windows x64

---

## Architecture Patterns

### Monorepo Organization
- Centralized dependency management via npm workspaces
- Shared packages for common functionality
- Independent deployment per service
- Workspace-based build system

### Three-Database Strategy
- **Separation of concerns** - Identity, Content, User Data
- **Independent scaling** - Each database scales independently
- **Data isolation** - Clear boundaries between domains
- **API-first access** - No direct database access from frontends

### API Gateway Pattern
- Each database has dedicated API service
- Cross-database operations via API calls
- Consistent authentication across services
- Centralized rate limiting and logging

### Event-Driven Processing
- BullMQ for async job processing
- Redis pub/sub for real-time updates
- Activity logging for analytics

---

## Strengths & Considerations

### Strengths

1. **Clean Architecture**
   - Three-database separation provides clear boundaries
   - Shared packages reduce code duplication
   - API-first design enables flexible frontends

2. **Modern Stack**
   - TypeScript throughout for type safety
   - Latest Node.js, .NET, and database versions
   - Hono for lightweight, fast APIs

3. **Comprehensive AI Integration**
   - Multiple AI providers for redundancy
   - Vector search for semantic features
   - Persona system for specialized interactions

4. **Enterprise-Ready**
   - RBAC, audit logging, 2FA
   - MSI installer for group policy deployment
   - Content filtering for managed environments

5. **Well-Documented**
   - Clear port assignments
   - Migration guides
   - Architecture documentation

### Considerations

1. **Complexity**
   - Three databases require coordination
   - Multiple services to maintain
   - Learning curve for new developers

2. **Testing Coverage**
   - Jest/Vitest setup exists but coverage varies
   - Integration tests for cross-service operations needed

3. **Monitoring**
   - Prometheus metrics available
   - Consider centralized logging (ELK/similar)
   - APM integration recommended

4. **Git Repository**
   - No git history detected
   - Recommend initializing git for version control

---

## Quick Reference Commands

```bash
# Start everything for development
npm run docker:infra && npm run migrate:all && npm run dev:apis

# Just the main app (JubileeVerse)
npm run docker:infra && npm run dev:verse

# Build desktop app
cd applications/JubileeBrowser.wpf && dotnet publish -c Release

# Check database status
npm run migrate:status

# Run all tests
npm run test

# Lint and fix
npm run lint:fix
```

---

## Contact & Resources

- **Documentation:** `/docs/` directory
- **Architecture:** `/docs/ARCHITECTURE.md`
- **Development Guide:** `/docs/DEVELOPMENT.md`
- **Migration Guide:** `/docs/MIGRATION_GUIDE.md`

---

*Document generated for JubileeEnterprise.com project analysis and onboarding.*
