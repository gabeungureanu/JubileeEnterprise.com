# Inspire Web Spaces Portal

The central SSO portal and web space registry for the Worldwide Bible Web ecosystem.

## Overview

This website serves a dual, tightly integrated purpose:

1. **SSO Portal** — Central authentication for all Jubilee services (Browser, Bible, JubileeVerse, etc.)
2. **Web Space Registry** — Registration and management of private Inspire Web Spaces

## Architecture

```
website/
├── backend/          # Hono.js API server
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   ├── middleware/
│   │   └── db/       # Database migrations
│   └── migrations/   # SQL migrations
│
├── frontend/         # Next.js application
│   └── src/
│       ├── app/      # Pages (App Router)
│       ├── components/
│       └── lib/      # API client, auth helpers
│
└── shared/           # Shared types (future use)
```

## Important: Private Network

**Inspire Web Spaces are NOT part of the public Internet.**

- They do not exist in ICANN or public DNS
- They are resolved exclusively by Jubilee Browser
- They represent spaces within the Worldwide Bible Web only

## Supported TLDs

| TLD | Description | Restricted |
|-----|-------------|------------|
| .inspire | Official Jubilee personas/entities | Yes |
| .church | Churches and congregations | No |
| .ministry | Ministry organizations | No |
| .faith | Faith-based initiatives | No |
| .community | Faith communities | No |
| .apostle | Apostolic ministries | No |
| .prophet | Prophetic ministries | No |
| .evangelist | Evangelistic outreach | No |
| .shepherd | Pastoral care ministries | No |
| .teacher | Teaching ministries | No |
| .worship | Worship ministries | No |
| .prayer | Prayer ministries | No |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (running via Docker)
- SSO service running (jubilee-sso)

### Backend Setup

```bash
cd website/backend
npm install

# Create .env file
cp ../../config/environments/.env.example .env
# Edit .env with your settings

# Run migrations
npm run migrate

# Seed TLDs
npx tsx src/db/seed-tlds.ts

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd website/frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
echo "NEXT_PUBLIC_SSO_URL=http://localhost:3000" >> .env.local

# Start development server
npm run dev
```

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/domains/tlds | List available TLDs |
| POST | /api/domains/check | Check domain availability |
| GET | /api/domains/check/:name | Quick availability check |
| GET | /api/domains/resolve/:domain | Resolve domain (for Jubilee Browser) |

### Authenticated

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/domains/register | Register a new domain |
| GET | /api/domains/my | Get user's domains |
| GET | /api/domains/:id | Get domain details |
| PATCH | /api/domains/:id | Update domain settings |
| POST | /api/domains/:id/renew | Renew domain |

## Domain Registration Flow

1. User searches for domain availability
2. User selects available domain
3. User authenticates via Jubilee SSO (if not already)
4. User completes payment ($3/year default)
5. Domain is activated and added to user's account
6. Domain is resolvable via Jubilee Browser

## Environment Variables

### Backend

```env
DATABASE_URL=postgresql://...
SSO_ISSUER_URL=http://localhost:3000
SSO_CLIENT_ID=jubilee-website
SESSION_SECRET=...
STRIPE_SECRET_KEY=... (optional)
FRONTEND_URL=http://localhost:3003
```

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SSO_URL=http://localhost:3000
```

## Payment Integration

Stripe is optional. In development mode (no Stripe keys), domain registration is simulated as free.

For production, configure:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Security

- All domain management requires authentication
- Domain ownership is strictly enforced
- Reserved domains prevent registration of system/offensive names
- The `.inspire` TLD is restricted to official use

## Integration with Jubilee Browser

Jubilee Browser queries the `/api/domains/resolve/:domain` endpoint to:

1. Check if a domain exists
2. Get resolution information
3. Route traffic within the WWBW network

Example resolution response:
```json
{
  "exists": true,
  "fullDomain": "myministry.church",
  "tld": "church",
  "status": "active",
  "metadata": {},
  "records": []
}
```
