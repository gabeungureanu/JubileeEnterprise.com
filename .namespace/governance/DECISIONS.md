# ARCHITECTURAL DECISIONS REGISTRY

**Authority Level**: ABSOLUTE
**Purpose**: Record of all final architectural decisions. Decisions marked FINAL are immutable without explicit unlock workflow.

---

## DECISION FORMAT

Each decision follows this structure:
- **ID**: Unique identifier (ARCH-XXXX)
- **Status**: FINAL | ACTIVE | DEPRECATED
- **Date**: Decision date
- **Decision**: Clear statement of the decision
- **Rationale**: Why this decision was made
- **Alternatives Rejected**: What was considered and rejected
- **Unlock Required**: Yes/No - whether this can be revisited

---

## FINAL DECISIONS

### ARCH-0001: Windows Service Architecture
**Status**: FINAL
**Date**: 2026-01-17
**Decision**: All production Node.js services run as Windows Services using node-windows, managed by inspire-service-manager.cjs
**Rationale**:
- Native Windows integration
- Automatic startup on boot
- Proper service lifecycle management
- No dependency on third-party process managers
**Alternatives Rejected**:
- PM2 (cross-platform concerns, not Windows-native)
- Docker for Node services (unnecessary complexity)
- Manual process management (unreliable)
**Unlock Required**: Yes - requires explicit unlock workflow in UNLOCK_REQUESTS.json

---

### ARCH-0002: API-Only Database Access
**Status**: FINAL
**Date**: 2026-01-17
**Decision**: All database operations go through InspireCodex.com API (port 3100) or InspireContinuum.com API (port 3200). No direct database connections from other services.
**Rationale**:
- Single point of database logic
- Consistent security enforcement
- Easier auditing and logging
- Simplified connection pooling
**Alternatives Rejected**:
- Direct PostgreSQL connections from each service
- GraphQL federation
- Database replication per service
**Unlock Required**: Yes

---

### ARCH-0003: Production Health Check Standard
**Status**: FINAL
**Date**: 2026-01-18
**Decision**: All health checks for production status reporting MUST test actual HTTPS production URLs, never localhost ports.
**Rationale**:
- Localhost can be up while production is down (Cloudflare/tunnel issues)
- Users access via HTTPS, health checks must reflect user experience
- Previous false positives caused customer complaints
**Alternatives Rejected**:
- Localhost port checks (caused false positives)
- Hybrid localhost + public checks (unnecessary complexity)
**Unlock Required**: Yes

---

### ARCH-0004: Cloudflared Tunnel Management
**Status**: FINAL
**Date**: 2026-01-18
**Decision**: Cloudflared tunnel is managed by inspire80cloudflaredservices.exe Windows Service, which checks for active tunnel connections (not just process existence) before considering tunnel healthy.
**Rationale**:
- Bare cloudflared.exe process doesn't mean tunnel is connected
- Must verify active EDGE connections via `cloudflared tunnel info`
- Orphaned processes must be killed before starting managed tunnel
**Alternatives Rejected**:
- Simple process existence check (caused tunnel failures)
- Manual tunnel management
**Unlock Required**: Yes

---

### ARCH-0005: Service Port Allocation
**Status**: FINAL
**Date**: 2026-01-17
**Decision**: Service ports are allocated as follows:
- 3000-3009: Core websites
- 3100-3139: Website services (per websites-services.json)
- 3200: InspireContinuum API
- 3900-3903: Health check endpoints
**Rationale**: Clear separation, no conflicts, easy to remember
**Alternatives Rejected**: Random port assignment
**Unlock Required**: No (ports can be added, not restructured)

---

### ARCH-0006: Branch Naming Convention
**Status**: FINAL
**Date**: 2026-01-15
**Decision**:
- GU branches (GUYYYY-MMDD): Personal branches for project owner
- LX branches (LXYYYY-MMDD): Development team branches
**Rationale**: Clear separation of work streams
**Alternatives Rejected**: Feature-based naming, ticket-based naming
**Unlock Required**: No

---

## ACTIVE DECISIONS (Non-Final)

### ARCH-0010: ESM vs CommonJS
**Status**: ACTIVE
**Date**: 2026-01-17
**Decision**: Service managers use CommonJS (.cjs). Website servers may use either but must have package.json without "type": "module" to prevent inheritance issues.
**Rationale**: Windows Services require CommonJS for reliability
**Unlock Required**: No

---

## UNLOCK WORKFLOW

To unlock a FINAL decision:

1. Create entry in `.namespace/testing/UNLOCK_REQUESTS.json`:
```json
{
  "decision_id": "ARCH-0001",
  "requested_by": "developer_name",
  "timestamp": "2026-01-18T12:00:00Z",
  "reason": "Detailed technical justification",
  "approved_by": null,
  "status": "PENDING"
}
```

2. Obtain approval from project owner
3. Update `approved_by` and `status` to "APPROVED"
4. Make changes with reference to unlock request
5. Update this document with new decision or amendment
6. Close unlock request with `status: "COMPLETED"`

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-18 | Jubilee | Initial decisions registry |
