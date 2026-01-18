# CONTEXT SUMMARY

**Purpose**: Concise, AI-friendly summary of non-negotiable project constraints
**Usage**: Auto-prepended to all AI prompts via bootstrap mechanism

---

## PROJECT: Jubilee Enterprise Platform

### Identity
- **Project Owner**: "Daddy"
- **AI Assistant Name**: "Jubilee"
- **Environment**: Windows Server, Production
- **Repository**: JubileeEnterprise.com Bibleweb

---

## CRITICAL CONSTRAINTS (NEVER VIOLATE)

### 1. FORBIDDEN TECHNOLOGIES
- **PM2**: BANNED - Use Windows Services instead
- **Direct DB connections**: BANNED - Use API layer only
- **Localhost health checks**: BANNED - Use production HTTPS URLs

### 2. REQUIRED ARCHITECTURE
- **Process Management**: Windows Services via node-windows
- **Service Manager**: inspire-service-manager.cjs (CommonJS)
- **Database Access**: InspireCodex.com API (port 3100) only
- **Health Checks**: Test `https://domain.com/` not `localhost:port`

### 3. KEY PORTS
| Service | Port |
|---------|------|
| InspireCodex API | 3100 |
| InspireContinuum API | 3200 |
| Website Services Health | 3900 |
| API Services Health | 3901 |
| Docker Services Health | 3902 |
| Cloudflared Health | 3903 |

---

## BEFORE ANY CODE CHANGE

1. Check if module is LOCKED in `TEST_REGISTRY.json`
2. Check if directory is FROZEN in `FREEZE_ZONES.md`
3. Verify compliance with `SYSTEM_STANDARD.md`
4. Include `[NAMESPACE-BOOTSTRAP: VERIFIED]` in output

---

## QUICK REFERENCE

### Approved Patterns
```javascript
// Health check - CORRECT
const response = await fetch('https://domain.com/');

// Health check - WRONG (never do this)
const response = await fetch('http://localhost:3000/');
```

### Service Manager Pattern
```javascript
// Always use CommonJS for service managers
'use strict';
const { spawn } = require('child_process');
// File must be .cjs extension
```

### Database Access Pattern
```javascript
// CORRECT - Use API
const data = await fetch('http://localhost:3100/api/v1/codex/users');

// WRONG - Direct connection (never do this)
const { Pool } = require('pg');
const pool = new Pool({ /* credentials */ });
```

---

## GOVERNANCE HIERARCHY

1. `.namespace/governance/SYSTEM_STANDARD.md` - Technical rules
2. `.namespace/governance/DECISIONS.md` - Architectural decisions
3. `.namespace/governance/AI_DEV_CONTRACT.md` - AI behavior rules
4. `.namespace/governance/FREEZE_ZONES.md` - Protected paths
5. `.namespace/testing/LOCK_RULES.md` - Module locking rules

---

## SESSION BEHAVIOR

- Every AI session starts fresh
- Always re-read governance documents
- Never assume previous context carries over
- When in doubt, check governance files

---

**This summary is automatically prepended to all AI prompts.**
