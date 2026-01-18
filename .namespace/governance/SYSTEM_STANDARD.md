# SYSTEM STANDARD

**Authority Level**: ABSOLUTE
**Effective Date**: 2026-01-18
**Last Updated**: 2026-01-18
**Status**: ACTIVE AND ENFORCED

---

## 1. PURPOSE

This document defines the authoritative, non-negotiable system standards for the Jubilee Enterprise platform. All development, AI assistance, and architectural decisions MUST comply with these standards. Violations will be blocked by automated enforcement.

---

## 2. FORBIDDEN TECHNOLOGIES

The following technologies are **PERMANENTLY BANNED** from this codebase. Any attempt to introduce them will be automatically rejected by pre-commit hooks and CI pipelines.

### 2.1 Process Managers
| Technology | Status | Reason |
|------------|--------|--------|
| PM2 | **FORBIDDEN** | systemd provides equivalent functionality without PM2 overhead |
| Forever | **FORBIDDEN** | Not compatible with systemd model |
| Nodemon (production) | **FORBIDDEN** | Development only; never in production |
| systemd (for Node) | **APPROVED (WSL2)** | Primary process supervisor for all Node.js services in WSL2 |

> **Amendment (2026-01-17)**: systemd is now APPROVED for WSL2 environment per UNLOCK-2026-0117-001. PM2 remains permanently FORBIDDEN.

### 2.2 Forbidden Patterns
- **Direct database connections** from application code (use InspireCodex.com API or InspireContinuum.com API)
- **Hardcoded credentials** in source files
- **localhost health checks** for production status (must use production HTTPS URLs)
- **ESM modules** in service managers (use CommonJS `.cjs` for Windows Services)

### 2.3 Forbidden File Patterns
```
pm2.config.js
pm2.config.cjs
ecosystem.config.js
ecosystem.config.cjs
.pm2/
pm2-*.json
```

---

## 3. APPROVED ARCHITECTURE

### 3.1 WSL2 + systemd Architecture (Primary)
All production Node.js services run inside WSL2 Ubuntu using systemd:
- **systemd unit files** for service supervision (`jubilee-*.service`)
- **Deterministic boot order** via After=/Requires= dependencies
- **Automatic restart** with watchdog and exponential backoff
- **Health endpoints** on dedicated ports (3900-3903)
- **Docker Engine** (not Desktop) for infrastructure containers
- **Nginx** reverse proxy for zero-downtime restarts

> **Note**: Windows Service model (node-windows) is deprecated as of 2026-01-17 per UNLOCK-2026-0117-001. Existing Windows Services remain operational for rollback capability during 30-day migration window.

### 3.2 Service Tiers (systemd)
| Tier | Target/Service | Description |
|------|----------------|-------------|
| Infrastructure | `jubilee-docker.service` | PostgreSQL, Qdrant, Redis via Docker Compose |
| APIs | `jubilee-api.target` | InspireCodex, InspireContinuum, Flywheel, Reactors |
| Websites | `jubilee-websites.target` | All 36 website frontends |
| Tunnel | `jubilee-cloudflared.service` | Cloudflare tunnel management |
| Monitoring | `prometheus`, `grafana` | Metrics and dashboards |

### 3.3 Boot Order (Deterministic)
```
multi-user.target
└── docker.service
    └── jubilee-docker.service (PostgreSQL, Qdrant, Redis)
        └── jubilee-api.target (4 API services)
            └── jubilee-websites.target (36 websites)
                └── jubilee-cloudflared.service
```

### 3.4 Database Access
- **Codex/Inspire databases**: Access ONLY via InspireCodex.com API (port 3100)
- **Continuum database**: Access ONLY via InspireContinuum.com API (port 3200)
- **No direct PostgreSQL connections** from frontend or other services

### 3.5 Health Check Standard
All health checks MUST:
1. Test **production HTTPS URLs** (e.g., `https://domain.com/`)
2. **NEVER** test localhost ports for production status reporting
3. Return accurate HTTP status codes (200, 502, 503, etc.)
4. Include response time metrics

---

## 4. CODING STANDARDS

### 4.1 File Naming
- Windows Service managers: `*.cjs` (CommonJS required)
- Website servers: `server.js`
- Configuration: `*-services.json`

### 4.2 Error Handling
- All services must handle `SIGTERM` and `SIGINT` gracefully
- Implement exponential backoff for restart attempts
- Log all errors with timestamps

### 4.3 Configuration
- All environment-specific values in `.env` files
- Use `process.env.SERVICE_CONFIG` for service configuration paths
- Never hardcode paths with spaces without proper quoting

---

## 5. ENFORCEMENT

This standard is enforced by:
1. **Pre-commit hooks** - Block commits containing forbidden patterns
2. **CI pipeline** - Reject PRs violating standards
3. **AI bootstrap** - All AI sessions receive this document automatically

### 5.1 Violation Response
| Severity | Response |
|----------|----------|
| Forbidden technology | Automatic commit rejection |
| Architectural violation | PR blocked until fixed |
| Standard deviation | Warning + required justification |

---

## 6. AMENDMENT PROCESS

Changes to this document require:
1. Written justification with technical rationale
2. Approval from project owner ("Daddy")
3. Update to version history below
4. Notification to all developers

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-18 | Jubilee | Initial system standard |
| 1.1.0 | 2026-01-17 | Jubilee | WSL2 + systemd architecture approved (UNLOCK-2026-0117-001). Windows Services deprecated. |
