# Developer Onboarding Guide

Welcome to the Jubilee SSO development team. This guide will help you set up your local development environment and understand the project structure.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** (LTS recommended)
- **Docker & Docker Compose** (for local infrastructure)
- **PostgreSQL client** (optional, for direct database access)
- **OpenSSL** (for certificate generation)
- **Git**

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url> JubileeInternet.com
cd JubileeInternet.com
```

### 2. Run Setup Script

**Linux/macOS:**
```bash
chmod +x scripts/*.sh
./scripts/setup-dev.sh
```

**Windows (PowerShell):**
```powershell
.\scripts\setup-dev.ps1
```

This script will:
- Install all dependencies
- Create a `.env` file from the template
- Generate development TLS certificates
- Start Docker containers (PostgreSQL, Redis, Mailhog)
- Run database migrations
- Seed test data

### 3. Configure Environment Variables

Edit the `.env` file in the project root:

```bash
# Generate JWT keys
./scripts/generate-keys.sh
```

Copy the generated keys into your `.env` file.

### 4. Start the Service

```bash
cd services/jubilee-sso
npm run dev
```

The SSO service will be available at `https://localhost:3000`.

## Manual Setup (Alternative)

If you prefer to set up components individually:

### Install Dependencies

```bash
npm install
```

### Start Infrastructure

```bash
docker-compose -f infra/docker/docker-compose.dev.yml up -d
```

### Run Migrations

```bash
cd services/jubilee-sso
npm run migrate
```

### Seed Test Data

```bash
npm run seed:dev
```

## Verifying Your Setup

### Health Check

```bash
curl -k https://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "checks": {
    "database": "ok"
  }
}
```

### OpenID Configuration

```bash
curl -k https://localhost:3000/.well-known/openid-configuration
```

### Test Login Flow

1. Navigate to: `https://localhost:3000/oauth/authorize?client_id=jubilee-browser-dev&redirect_uri=https://localhost:8080/callback&response_type=code&scope=openid%20profile%20email`
2. Log in with test credentials:
   - Email: `test@jubilee.com`
   - Password: `TestPassword123!`

## Project Structure

```
JubileeInternet.com/
├── services/
│   └── jubilee-sso/      # Core SSO service
│       ├── src/          # TypeScript source
│       ├── tests/        # Test files
│       └── migrations/   # Database migrations
├── packages/
│   └── shared/           # Shared utilities
├── config/               # Environment configs
├── infra/                # Infrastructure as code
├── scripts/              # Development scripts
└── docs/                 # Documentation
```

## Development Workflow

### Running Tests

```bash
cd services/jubilee-sso

# Unit tests
npm run test

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage
```

### Code Quality

```bash
# Linting
npm run lint
npm run lint:fix

# Type checking
npm run typecheck

# Formatting
npm run format
```

### Database Migrations

```bash
# Create a new migration
npm run migrate:create -- add-feature-table

# Run migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback
```

## Test Accounts

| Email | Password | Description |
|-------|----------|-------------|
| test@jubilee.com | TestPassword123! | Standard test user |
| admin@jubilee.com | AdminPassword123! | Admin test user |

## Test OAuth Clients

| Client ID | Client Secret | Type |
|-----------|---------------|------|
| jubilee-browser-dev | (none - public) | Public |
| jubilee-bible-dev | bible-dev-secret-12345 | Confidential |
| jubilee-service-dev | service-dev-secret-12345 | Service |

## Common Issues

### Port Already in Use

If port 3000 or 5432 is in use:

```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Or change the port in .env
PORT=3001
```

### Database Connection Failed

1. Ensure Docker is running
2. Check container status: `docker ps`
3. View logs: `docker logs jubilee-sso-postgres`

### TLS Certificate Issues

If you see certificate errors in the browser:

1. Trust the development certificate (see `scripts/generate-dev-certs.sh` for instructions)
2. Or use `curl -k` to skip verification during development

## Getting Help

- Check the [Security Guidelines](security.md)
- Review the [API Reference](api.md)
- Ask in the development Slack channel

## Security Reminders

1. **Never commit secrets** - All credentials go in `.env` (which is gitignored)
2. **Review changes carefully** - This is security-critical infrastructure
3. **Report vulnerabilities** - Contact the security team immediately
4. **Follow least privilege** - Request only necessary permissions
