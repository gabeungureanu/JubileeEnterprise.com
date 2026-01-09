# Deployment Guide

This document describes how to deploy Jubilee SSO to staging and production environments.

## Environment Parity

All environments (local, staging, production) use identical:
- Docker images
- Database schema
- API structure
- Configuration keys (different values)

The only differences are:
- Scale (replicas, database size)
- Secrets (keys, passwords)
- Network configuration (domains, TLS)

## Prerequisites

- Docker and Docker Compose
- Access to container registry
- Access to secrets management system
- Database (PostgreSQL 15+)
- TLS certificates (Let's Encrypt or similar)

## Deployment Architecture

```
                    ┌─────────────┐
                    │   Clients   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Load Balancer│
                    │   (TLS)     │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
      ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
      │ SSO Pod 1 │  │ SSO Pod 2 │  │ SSO Pod N │
      └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │    (HA)     │
                    └─────────────┘
```

## Building the Docker Image

```bash
# Build image
docker build -t jubilee-sso:latest -f infra/docker/Dockerfile .

# Tag for registry
docker tag jubilee-sso:latest registry.jubilee.com/jubilee-sso:v1.0.0

# Push to registry
docker push registry.jubilee.com/jubilee-sso:v1.0.0
```

## Staging Deployment

### 1. Configure Secrets

Set up secrets in your secrets manager:

```bash
# Database
STAGING_DATABASE_URL=postgresql://user:pass@db-staging.internal:5432/jubilee_sso

# JWT Keys (generate unique keys!)
STAGING_JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
STAGING_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."

# Session
STAGING_SESSION_SECRET=<32+ character secret>
```

### 2. Deploy Database

Ensure PostgreSQL is running and accessible.

### 3. Run Migrations

```bash
DATABASE_URL=$STAGING_DATABASE_URL npm run migrate
```

### 4. Deploy Service

Using Docker Compose:
```bash
docker-compose -f infra/docker/docker-compose.yml up -d
```

Or Kubernetes:
```bash
kubectl apply -f infra/k8s/staging/
```

### 5. Verify Deployment

```bash
curl https://sso-staging.jubilee.com/health
curl https://sso-staging.jubilee.com/.well-known/openid-configuration
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Security review completed
- [ ] Staging testing completed
- [ ] Database backup taken
- [ ] Rollback plan documented
- [ ] On-call team notified

### 1. Database Migration

**IMPORTANT:** Always run migrations before deploying new code.

```bash
# Backup first
pg_dump $PRODUCTION_DATABASE_URL > backup-$(date +%Y%m%d).sql

# Run migrations
DATABASE_URL=$PRODUCTION_DATABASE_URL npm run migrate
```

### 2. Rolling Deployment

Deploy with zero downtime using rolling updates:

```yaml
# Kubernetes example
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

### 3. Health Check Verification

Wait for health checks to pass before routing traffic:

```bash
# Check each pod
for pod in $(kubectl get pods -l app=jubilee-sso -o name); do
  kubectl exec $pod -- curl -s localhost:3000/health
done
```

### 4. Smoke Tests

Run automated smoke tests:
- OAuth authorization flow
- Token issuance
- Token validation
- Health endpoints

### 5. Monitor

Watch metrics and logs for:
- Error rates
- Response times
- Database connections
- Memory usage

## Rollback Procedure

If issues are detected:

### 1. Immediate Rollback

```bash
# Docker Compose
docker-compose -f infra/docker/docker-compose.yml down
docker-compose -f infra/docker/docker-compose.yml up -d --pull=never

# Kubernetes
kubectl rollout undo deployment/jubilee-sso
```

### 2. Database Rollback (if needed)

```bash
# Only if migration caused issues
DATABASE_URL=$PRODUCTION_DATABASE_URL npm run migrate:rollback

# Or restore from backup
psql $PRODUCTION_DATABASE_URL < backup-YYYYMMDD.sql
```

## Scaling

### Horizontal Scaling

The SSO service is stateless and can scale horizontally:

```bash
# Docker Compose
docker-compose -f infra/docker/docker-compose.yml up -d --scale jubilee-sso=3

# Kubernetes
kubectl scale deployment/jubilee-sso --replicas=5
```

### Database Scaling

For high availability:
- Use managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
- Configure read replicas for read-heavy operations
- Set up automatic failover

## Monitoring

### Health Endpoints

| Endpoint | Purpose | Alert Threshold |
|----------|---------|-----------------|
| `/health` | Full health | 5xx errors |
| `/ready` | Ready for traffic | 5xx for 30s |
| `/live` | Process alive | 5xx for 10s |

### Key Metrics

- `http_requests_total` - Request count by endpoint and status
- `http_request_duration_seconds` - Request latency
- `db_connections_active` - Database connection pool usage
- `token_issued_total` - Tokens issued count

### Log Aggregation

All logs are structured JSON and should be ingested into:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Or similar (Datadog, Splunk, etc.)

Filter for `audit: true` for security events.

## Security Considerations

### TLS Configuration

- Use TLS 1.2 or higher
- Strong cipher suites only
- HSTS enabled
- Certificate auto-renewal

### Network Security

- SSO service in private subnet
- Database not publicly accessible
- Rate limiting at load balancer
- WAF for additional protection

### Secrets Rotation

Schedule regular rotation of:
- JWT signing keys (with grace period for old tokens)
- Database credentials
- Session secrets

## Disaster Recovery

### Backup Strategy

| Data | Frequency | Retention |
|------|-----------|-----------|
| Database | Hourly | 30 days |
| Audit logs | Real-time | 1 year |
| Configuration | On change | Indefinite |

### Recovery Time Objectives

- RTO (Recovery Time): < 1 hour
- RPO (Recovery Point): < 1 hour

### Recovery Procedure

1. Restore database from backup
2. Deploy known-good container image
3. Verify health checks
4. Restore traffic routing
5. Notify users if extended outage
