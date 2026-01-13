# Jubilee Enterprise

A unified monorepo containing all Jubilee Enterprise websites and applications.

## Overview

This repository serves as the coordination layer for multiple independent website projects.
Each website lives in its own dedicated subdirectory and can be developed, tested, and deployed independently.

## Structure

```
JubileeEnterprise.com/
├── packages/                    # Shared packages
│   └── shared/                  # @jubilee/shared - Common utilities
├── websites/                    # Website projects
│   ├── launcher/                # Development navigation hub
│   └── codex/                   # Production websites
│       ├── JubileeBrowser.com/      # Browser marketing site
│       ├── JubileeInspire.com/      # AI Bible chat interface
│       ├── JubileeIntelligence.com/ # AI content generation
│       ├── JubileeInternet.com/     # SSO & identity services
│       ├── JubileePersonas.com/     # AI persona management
│       ├── JubileeVerse.com/        # Faith-based AI chat
│       └── JubileeWebsites.com/     # AI website generation
├── applications/                # Desktop applications
│   └── JubileeBrowser.wpf/      # Windows browser (.NET/WPF)
├── services/                    # Service management
│   └── unified/                 # Unified Windows Service manager
├── helps/                       # Documentation
├── infrastructure/              # Shared infrastructure configs
│   └── docker/                  # Docker compose files
└── .vscode/                     # VS Code workspace config
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop
- Visual Studio 2022 (for .NET projects)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd JubileeEnterprise.com

# Install all dependencies
npm install

# Build shared packages
npm run build:packages

# Start infrastructure services (PostgreSQL, Redis, Qdrant)
npm run docker:infra
```

### Development

```bash
# Start the development launcher (http://localhost:3000)
npm run launcher

# Start individual websites
npm run dev:verse          # JubileeVerse.com     - Port 3007
npm run dev:internet       # JubileeInternet.com  - Port 3005
npm run dev:intelligence   # JubileeIntelligence  - Port 3004
npm run dev:personas       # JubileePersonas.com  - Port 3006
npm run dev:websites       # JubileeWebsites.com  - Port 3008
npm run dev:browser-site   # JubileeBrowser.com   - Port 3002
```

### VS Code Workspace

Open the multi-root workspace for the best development experience:

```bash
code .vscode/jubilee-solutions.code-workspace
```

## Port Assignments

See [PORTS.md](./PORTS.md) for detailed port assignments.

| Service | Port |
|---------|------|
| Launcher | 3000 |
| JubileeBrowser.com | 3002 |
| JubileeInspire.com | 3003 |
| JubileeIntelligence.com | 3004 |
| JubileeInternet.com | 3005 |
| JubileePersonas.com | 3006 |
| JubileeVerse.com | 3007 |
| JubileeWebsites.com | 3008 |

## Shared Packages

### @jubilee/shared

Common utilities used across all projects:

```typescript
// Authentication
import { TokenValidator, extractBearerToken } from '@jubilee/shared/auth';

// Configuration
import { getServiceConfig, getDatabaseConfig } from '@jubilee/shared/config';

// Errors
import { JubileeError, ValidationError } from '@jubilee/shared/errors';

// HTTP utilities
import { successResponse, errorResponse } from '@jubilee/shared/http';

// Logging
import { createLogger } from '@jubilee/shared/logging';

// Validation
import { emailSchema, passwordSchema } from '@jubilee/shared/validation';
```

## Production Deployment (Windows Service)

All production websites are managed by a **unified Windows Service** with **Node.js cluster mode** (16 workers per service) (`jubileeservices.exe`). This service automatically starts on Windows boot and manages all Node.js applications.

### Service Management

```bash
# Check service status
sc query jubileeservices.exe

# Health check endpoint
curl http://localhost:3999/health

# Start/Stop/Restart (requires Administrator)
net start jubileeservices.exe
net stop jubileeservices.exe
powershell -Command "Restart-Service jubileeservices.exe"

# Hot reload all services (no restart needed)
cd services/unified
node reload-service.cjs
```

### Production Port Assignments

| Service | Port | Description |
|---------|------|-------------|
| JubileeVerse.com | 3000 | Main Website |
| JubileeInspire.com | 3001 | Inspiration Platform |
| wwBibleweb.com | 3003 | Bible Web Platform |
| JubileeWebsites.com | 3008 | Website Generator |
| JubileeParadox.com | 3009 | Movie Website |
| InspireCodex API | 3100 | Identity & Configuration |
| InspireContinuum API | 3101 | User Activity & Chat |
| JubileeBrowser.com | 3200 | Browser Downloads |
| CelestialPaths.com | 3300 | Celestial Paths |
| Health Endpoint | 3999 | Service Manager Health |

### Configuration

Service configuration is in `services/unified/services.json`. See [helps/windows-service.md](./helps/windows-service.md) for detailed documentation.

### Admin Dashboard

Real-time monitoring dashboard: **http://localhost:3008/admin/**

### Docker Deployment (Alternative)

```bash
# Build a specific website for production
cd websites/codex/JubileeVerse.com
docker build -t jubilee-verse .

# Run the container
docker run -p 3007:3007 --env-file .env jubilee-verse
```

## Infrastructure

Start shared infrastructure services:

```bash
# Start all infrastructure
npm run docker:infra

# Stop all infrastructure
npm run docker:infra:down
```

Services included:
- PostgreSQL 16 (port 5432)
- Redis 7 (port 6379)
- Qdrant (port 6333)
- Mailhog (ports 1025, 8025)
- Redis Commander (port 8081)
- pgAdmin (port 8082)

## Testing

```bash
# Run all tests
npm run test

# Run tests for a specific workspace
npm run test --workspace=@jubilee/verse
```

## Linting

```bash
# Lint all projects
npm run lint

# Fix linting issues
npm run lint:fix
```

## Adding a New Website

1. Create a new directory under `websites/codex/`
2. Add a `package.json` with a unique `@jubilee/` scoped name
3. Assign the next available port (see PORTS.md)
4. Add the workspace to the root `package.json`
5. Update the launcher service
6. Update VS Code workspace configuration
7. Create a Dockerfile for production deployment

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Each website may have its own `.env` file for project-specific settings.

## License

UNLICENSED - Private and proprietary.
