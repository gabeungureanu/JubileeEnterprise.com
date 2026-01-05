# Setup and Deployment Guide

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20.x+ | Runtime |
| npm | 10.x+ | Package manager |
| Docker | 24.x+ | Containerization |
| Docker Compose | 2.x+ | Local orchestration |

### Optional (for Kubernetes deployment)

| Software | Version | Purpose |
|----------|---------|---------|
| kubectl | 1.28+ | Kubernetes CLI |
| Kustomize | 5.x+ | K8s configuration |
| Helm | 3.x+ | K8s package manager |

## Local Development Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/jubileeverse.git
cd jubileeverse

# Install dependencies
npm install
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env  # or use your preferred editor
```

**Required Environment Variables:**

```bash
# Server
NODE_ENV=development
PORT=3000
HOST=localhost

# Session (generate strong random key)
SESSION_SECRET=your-secret-key-at-least-32-characters

# Database (Docker Compose defaults)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jubileeverse
DB_USER=jubilee
DB_PASSWORD=jubilee_password

# Redis (Docker Compose defaults)
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant (Docker Compose defaults)
QDRANT_HOST=localhost
QDRANT_PORT=6333

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and Qdrant
docker-compose up -d postgres redis qdrant

# Verify services are running
docker-compose ps
```

### 4. Initialize Database

```bash
# Run database migrations
npm run db:migrate

# Seed initial data (personas, categories)
npm run db:seed
```

### 5. Start Application

```bash
# Development mode with hot reload
npm run dev

# Or production mode
npm start
```

### 6. Verify Installation

```bash
# Health check
curl http://localhost:3000/api/admin/health

# Should return:
# {"status":"healthy","timestamp":"...","uptime":...}
```

**Access the application:** http://localhost:3000

## Docker Development

### Full Stack with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down
```

### With Development Tools

```bash
# Include Redis Commander and pgAdmin
docker-compose --profile dev-tools up -d

# Access:
# - App: http://localhost:3000
# - Redis Commander: http://localhost:8081
# - pgAdmin: http://localhost:8082
```

### With Monitoring Stack

```bash
# Include Prometheus, Grafana, Alertmanager
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access:
# - Grafana: http://localhost:3001 (admin/jubilee123)
# - Prometheus: http://localhost:9090
# - Alertmanager: http://localhost:9093
```

## Running Tests

### All Tests

```bash
# Run all tests with coverage
npm test
```

### Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode for TDD
npm run test:watch
```

### Test Coverage

```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

## Production Deployment

### Option 1: Docker Compose (Single Server)

```bash
# Build production image
docker build -t jubileeverse/app:v8.0.0 .

# Start with production compose
docker-compose -f docker-compose.prod.yml up -d

# Verify
curl https://your-domain.com/api/admin/health
```

### Option 2: Kubernetes

#### Prerequisites

1. Kubernetes cluster (EKS, GKE, AKS, or self-managed)
2. kubectl configured
3. Container registry access

#### Deploy

```bash
# Build and push image
docker build -t your-registry.com/jubileeverse/app:v8.0.0 .
docker push your-registry.com/jubileeverse/app:v8.0.0

# Update image in kustomization
cd k8s/overlays/production
# Edit kustomization.yaml to set your registry

# Apply to cluster
kubectl apply -k .

# Verify deployment
kubectl -n jubileeverse get pods
kubectl -n jubileeverse get services
```

#### Configure Secrets

```bash
# Create namespace
kubectl create namespace jubileeverse

# Create secrets (use external secret management in production)
kubectl -n jubileeverse create secret generic jubileeverse-secrets \
  --from-literal=SESSION_SECRET='your-production-secret' \
  --from-literal=DB_PASSWORD='your-db-password' \
  --from-literal=OPENAI_API_KEY='sk-...'
```

#### Set Up Ingress

```bash
# Install NGINX Ingress Controller (if not present)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Apply ingress
kubectl apply -f k8s/base/ingress.yaml
```

#### Configure TLS

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@jubileeverse.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### Option 3: Cloud Platform (Heroku, Render, Railway)

Most PaaS platforms auto-detect Node.js. Configure:

1. Set environment variables in platform dashboard
2. Add Redis add-on (Heroku Redis, etc.)
3. Add PostgreSQL add-on
4. Deploy from Git or container registry

## Infrastructure Dependencies

### PostgreSQL

**Docker:**
```bash
docker run -d \
  --name jubileeverse-postgres \
  -e POSTGRES_DB=jubileeverse \
  -e POSTGRES_USER=jubilee \
  -e POSTGRES_PASSWORD=your-password \
  -p 5432:5432 \
  postgres:16-alpine
```

**Managed (Recommended for production):**
- AWS RDS
- Google Cloud SQL
- Azure Database for PostgreSQL
- DigitalOcean Managed Databases

### Redis

**Docker:**
```bash
docker run -d \
  --name jubileeverse-redis \
  -p 6379:6379 \
  redis:7-alpine redis-server --appendonly yes
```

**Managed (Recommended for production):**
- AWS ElastiCache
- Google Memorystore
- Azure Cache for Redis
- Redis Cloud

### Qdrant

**Docker:**
```bash
docker run -d \
  --name jubileeverse-qdrant \
  -p 6333:6333 \
  -v qdrant_data:/qdrant/storage \
  qdrant/qdrant:latest
```

**Managed:**
- Qdrant Cloud

## Development Environment (Current Setup)

### Database Configuration

PostgreSQL runs in a Docker container named `postgres`. The connection details are stored in the `.env` file:

```bash
# From .env file
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jubileeverse
DB_USER=guardian
DB_PASSWORD=askShaddai4e!
```

### Running Database Migrations

Migrations are located in `scripts/migrations/`. Since PostgreSQL is in Docker and `psql` may not be in the system PATH, use Node.js to run migrations:

```bash
# Run a migration via Node.js
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jubileeverse',
  user: 'guardian',
  password: 'askShaddai4e!'
});

const sql = fs.readFileSync('scripts/migrations/YOUR_MIGRATION.sql', 'utf8');
pool.query(sql)
  .then(() => { console.log('Migration complete'); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
"
```

Or run specific SQL commands:

```bash
# Example: Add a column
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'jubileeverse',
  user: 'guardian', password: 'askShaddai4e!'
});
pool.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS my_column VARCHAR(50)')
  .then(() => { console.log('Done'); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
"
```

### Verifying Database Tables

```bash
# List all columns in a table
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'jubileeverse',
  user: 'guardian', password: 'askShaddai4e!'
});
pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations' ORDER BY ordinal_position\")
  .then(r => { console.log(r.rows.map(x => x.column_name).join(', ')); pool.end(); });
"
```

### Docker Container Status

```bash
# Check if postgres container is running
docker ps --filter "name=postgres"

# View postgres container logs
docker logs postgres
```

## Environment Variables Reference

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | development | Environment (development/production) |
| `PORT` | No | 3000 | HTTP port |
| `HOST` | No | localhost | Bind address |

### Session

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | Yes | - | Session signing key (32+ chars) |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | localhost | PostgreSQL host |
| `DB_PORT` | No | 5432 | PostgreSQL port |
| `DB_NAME` | Yes | - | Database name |
| `DB_USER` | Yes | - | Database user |
| `DB_PASSWORD` | Yes | - | Database password |

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | Yes | localhost | Redis host |
| `REDIS_PORT` | No | 6379 | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password |
| `REDIS_DB` | No | 0 | Redis database number |

### Qdrant

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_HOST` | Yes | localhost | Qdrant host |
| `QDRANT_PORT` | No | 6333 | Qdrant port |
| `QDRANT_API_KEY` | No | - | Qdrant API key |

### AI Providers

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Conditional | - | OpenAI API key |
| `ANTHROPIC_API_KEY` | Conditional | - | Anthropic API key |

*At least one AI provider key is required.*

### Queue Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QUEUE_CONCURRENCY` | No | 10 | Worker concurrency |
| `QUEUE_RATE_LIMIT` | No | 50 | Jobs per second limit |

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | info | Log level (error/warn/info/debug) |
| `LOG_FORMAT` | No | json | Log format (json/pretty) |

## Health Checks

### Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `/api/admin/live` | Liveness (process running) | None |
| `/api/admin/ready` | Readiness (deps connected) | None |
| `/api/admin/health` | Full health status | None |

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /api/admin/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 15

readinessProbe:
  httpGet:
    path: /api/admin/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000
# Or on Windows
netstat -ano | findstr :3000

# Kill process
kill -9 <PID>
```

**Redis connection refused:**
```bash
# Check Redis is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test connection
redis-cli ping
```

**PostgreSQL connection failed:**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
psql -h localhost -U jubilee -d jubileeverse
```

**Permission denied for Docker:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run
newgrp docker
```

### Debug Logging

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check application logs
docker-compose logs -f app

# Check all logs
docker-compose logs -f
```

### Database Reset

```bash
# Stop services
docker-compose down

# Remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d
npm run db:migrate
npm run db:seed
```
