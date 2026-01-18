# FREEZE ZONES

**Authority Level**: ABSOLUTE
**Purpose**: Define directories that require explicit unlock before modification
**Enforcement**: Pre-commit hooks and CI pipeline

---

## 1. FREEZE ZONE CONCEPT

A **Freeze Zone** is a directory or file that:
- Contains critical infrastructure code
- Has been tested and approved
- Must not be casually modified
- Requires explicit unlock workflow to edit

---

## 2. FROZEN DIRECTORIES

### 2.1 Service Orchestration (CRITICAL)
| Path | Status | Reason |
|------|--------|--------|
| `services/Inspire.8.0/daemon/` | FROZEN | Windows Service executables and configs |
| `services/Inspire.8.0/*-service-manager.cjs` | FROZEN | Core service orchestration |

### 2.2 Governance (PROTECTED)
| Path | Status | Reason |
|------|--------|--------|
| `.namespace/` | FROZEN | All governance and enforcement files |

### 2.3 Deployment Scripts (CRITICAL)
| Path | Status | Reason |
|------|--------|--------|
| `services/Inspire.8.0/*.xml` | FROZEN | Windows Service definitions |
| `scripts/setup-*.ps1` | FROZEN | Developer environment setup |
| `scripts/setup-*.sh` | FROZEN | Developer environment setup |

---

## 3. CONDITIONALLY FROZEN

These zones are frozen AFTER tests pass and module is locked:

### 3.1 Core API Layer
| Path | Condition | Notes |
|------|-----------|-------|
| `websites/codex/InspireCodex.com/server.js` | After lock | Main API server |
| `websites/codex/InspireContinuum.com/server.js` | After lock | Continuum API |

### 3.2 UI Components
| Path | Condition | Notes |
|------|-----------|-------|
| `websites/codex/InspireCodex.com/public/services.html` | After lock | Admin dashboard |

---

## 4. EXEMPT FROM FREEZE

These paths are explicitly NOT frozen and may be modified freely:

### 4.1 Always Editable
| Path | Reason |
|------|--------|
| `websites/codex/*/public/` (except locked files) | Static content |
| `*.md` (except in `.namespace/`) | Documentation |
| `*.json` (config files) | Configuration updates |
| `.env*` | Environment configuration |

### 4.2 API Evolution Exempt
| Path | Reason |
|------|--------|
| `websites/codex/InspireCodex.com/routes/` | API routes evolve |
| `websites/codex/InspireCodex.com/services/` | Service layer evolves |
| `websites/codex/InspireContinuum.com/routes/` | API routes evolve |

---

## 5. UNLOCK WORKFLOW

To modify a frozen zone:

### 5.1 Create Unlock Request
Add entry to `.namespace/testing/UNLOCK_REQUESTS.json`:
```json
{
  "id": "UNLOCK-2026-0118-001",
  "type": "FREEZE_ZONE",
  "path": "services/Inspire.8.0/inspire-service-manager.cjs",
  "requested_by": "developer_name",
  "timestamp": "2026-01-18T12:00:00Z",
  "reason": "Need to add new service manager feature",
  "expires": "2026-01-19T12:00:00Z",
  "status": "PENDING"
}
```

### 5.2 Obtain Approval
- Project owner must update `status` to "APPROVED"
- Set reasonable expiration (24-48 hours typical)

### 5.3 Make Changes
- Changes allowed only while unlock is valid
- Must reference unlock ID in commit message

### 5.4 Re-Freeze
- After changes complete, run tests
- If tests pass, status auto-updates to "COMPLETED"
- Zone automatically re-freezes

---

## 6. ENFORCEMENT RULES

### 6.1 Pre-Commit Check
```
For each modified file:
  1. Check if path matches FROZEN zone
  2. If frozen, check for valid unlock in UNLOCK_REQUESTS.json
  3. Block commit if no valid unlock exists
```

### 6.2 CI Check
```
For each file in PR:
  1. Verify freeze zone compliance
  2. Verify unlock request exists and is approved
  3. Fail build if violations found
```

### 6.3 Violation Messages
```
ERROR: Frozen zone modification blocked
Path: services/Inspire.8.0/inspire-service-manager.cjs
Status: FROZEN
Action Required: Create unlock request in .namespace/testing/UNLOCK_REQUESTS.json
```

---

## 7. EMERGENCY OVERRIDE

In genuine emergencies (production down, security breach):

1. Add emergency unlock:
```json
{
  "id": "EMERGENCY-2026-0118-001",
  "type": "EMERGENCY",
  "path": "*",
  "reason": "Production outage - service not starting",
  "status": "EMERGENCY_APPROVED",
  "expires": "2026-01-18T14:00:00Z"
}
```

2. Make fix
3. Document in post-mortem
4. Review if zone definition needs adjustment

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-18 | Jubilee | Initial freeze zones |
