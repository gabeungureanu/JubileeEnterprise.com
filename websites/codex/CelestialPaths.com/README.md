# JubileeInternet.com

**Jubilee Single Sign-On (SSO) & Identity Services**

> **SECURITY-CRITICAL INFRASTRUCTURE** — This repository contains the core identity provider and authentication services for all Jubilee products.

---

## Overview

JubileeInternet.com is the root development environment for Jubilee's SSO and identity-related services. It serves as the authoritative Identity Provider (IdP) for:

- **Jubilee Browser** — Secure, faith-focused web browsing
- **Jubilee Bible** — Scripture study and devotional platform
- **Future Jubilee Services** — Extensible identity foundation

This repository implements OAuth 2.0 and OpenID Connect (OIDC) protocols, acting as the single source of truth for Jubilee user identities, authentication, and authorization.

---

## Security Posture

### Trust Boundary

This repository defines Jubilee's **identity trust boundary**. All services that consume Jubilee identity tokens trust the SSO service as the authoritative issuer.

### Security Principles

1. **Separation of Concerns** — Identity infrastructure is isolated from browser UI code
2. **Defense in Depth** — Multiple layers of validation and access control
3. **Least Privilege** — Database users, service accounts, and APIs operate with minimal permissions
4. **Audit Everything** — All authentication events are logged for security monitoring
5. **No Secrets in Code** — All credentials injected via environment variables or secret managers
6. **Immutable Infrastructure** — Reproducible deployments across all environments

### What This Repository Does NOT Contain

- Browser extension source code
- Frontend UI components (beyond minimal login pages)
- Third-party API integrations unrelated to identity
- User content or application data

---

## Repository Structure

```
JubileeInternet.com/
├── services/                 # Core identity services
│   └── jubilee-sso/          # OAuth 2.0 / OIDC Identity Provider
│       ├── src/              # TypeScript source code
│       ├── tests/            # Unit and integration tests
│       └── migrations/       # Database schema migrations
│
├── packages/                 # Shared libraries
│   └── shared/               # Common auth utilities, validators, types
│
├── config/                   # Environment configuration
│   └── environments/         # local, staging, production templates
│
├── infra/                    # Infrastructure as Code
│   ├── docker/               # Docker Compose configurations
│   ├── postgres/             # Database initialization scripts
│   └── nginx/                # Reverse proxy configurations
│
├── scripts/                  # Development and deployment scripts
│
├── docs/                     # Documentation
│
└── certs/                    # TLS certificates
    └── dev/                  # Development certificates (self-signed)
```

---

## Supported Environments

| Environment | Purpose | Database | TLS |
|-------------|---------|----------|-----|
| **local** | Developer workstations | Local Postgres / Docker | Self-signed |
| **staging** | Pre-production testing | Managed Postgres | Let's Encrypt |
| **production** | Live user traffic | Managed Postgres (HA) | Let's Encrypt |

All environments share identical architectural structure, differing only in scale and secrets management.

---

## Quick Start

### Prerequisites

- Node.js 20+ (LTS)
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- OpenSSL (for certificate generation)

### Setup

```bash
# Clone the repository
git clone <repository-url> JubileeInternet.com
cd JubileeInternet.com

# Install dependencies
npm install

# Copy environment template
cp config/environments/.env.example .env

# Generate development certificates
./scripts/generate-dev-certs.sh

# Start infrastructure (Postgres, etc.)
docker-compose -f infra/docker/docker-compose.dev.yml up -d

# Run database migrations
npm run migrate

# Seed test data (development only)
npm run seed:dev

# Start the SSO service
npm run dev
```

### Verify Installation

```bash
# Health check
curl https://localhost:3000/health

# OpenID Configuration
curl https://localhost:3000/.well-known/openid-configuration
```

---

## Development

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests (requires running database)
npm run test:integration

# All tests with coverage
npm run test:coverage
```

### Database Migrations

```bash
# Create a new migration
npm run migrate:create -- <migration-name>

# Run pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback
```

### Linting & Formatting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

---

## Authentication Flows

### Supported OAuth 2.0 / OIDC Flows

| Flow | Use Case |
|------|----------|
| Authorization Code + PKCE | Web applications, SPAs, mobile apps |
| Client Credentials | Service-to-service authentication |
| Refresh Token | Long-lived sessions with token rotation |

### Token Types

- **ID Token** — User identity claims (OIDC)
- **Access Token** — API authorization (JWT)
- **Refresh Token** — Secure token renewal

---

## Environment Variables

See [config/environments/.env.example](config/environments/.env.example) for the complete list.

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SIGNING_KEY` | Private key for token signing |
| `JWT_PUBLIC_KEY` | Public key for token verification |
| `ISSUER_URL` | Base URL of the SSO service |
| `SESSION_SECRET` | Secret for session encryption |

---

## Documentation

- [Developer Onboarding](docs/onboarding.md)
- [Security Guidelines](docs/security.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)

---

## Contributing

1. All changes require code review
2. Security-sensitive changes require security team approval
3. All commits must pass CI checks (lint, test, build)
4. No secrets in code, commits, or PR descriptions

---

## License

Proprietary — Jubilee Internet, Inc. All rights reserved.
