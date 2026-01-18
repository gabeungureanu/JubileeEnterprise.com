# LOCK RULES

**Authority Level**: ABSOLUTE
**Purpose**: Define module locking mechanism and enforcement
**Enforcement**: Pre-commit hooks and CI pipeline

---

## 1. LOCK MECHANISM OVERVIEW

### 1.1 Core Concept
**Modules that pass unit tests become LOCKED by default.**

A locked module:
- Cannot be modified without explicit unlock
- Has its fingerprint (hash) recorded
- Requires unlock request to change
- Auto-relocks after changes pass tests

### 1.2 State Diagram
```
                    ┌─────────────┐
                    │   NEW       │
                    └──────┬──────┘
                           │ tests pass
                           ▼
    ┌───────────────────────────────────────┐
    │                LOCKED                  │
    │  - Fingerprint recorded               │
    │  - Changes blocked                    │
    │  - Monitored by CI                    │
    └───────────────────────┬───────────────┘
                           │ unlock request
                           ▼
    ┌───────────────────────────────────────┐
    │               UNLOCKED                 │
    │  - Changes allowed                    │
    │  - Must re-lock after tests pass      │
    │  - Time-limited unlock                │
    └───────────────────────┬───────────────┘
                           │ tests pass
                           ▼
                    ┌─────────────┐
                    │   LOCKED    │
                    └─────────────┘
```

---

## 2. LOCK-BOUND MODULES

### 2.1 Always Lock-Bound (After Tests Pass)
These modules MUST be locked and cannot be changed without unlock:

| Module | Path | Reason |
|--------|------|--------|
| Website Service Manager | `services/Inspire.8.0/inspire-service-manager.cjs` | Core orchestration |
| Cloudflared Manager | `services/Inspire.8.0/cloudflared-service-manager.cjs` | Tunnel management |
| Docker Manager | `services/Inspire.8.0/docker-service-manager.cjs` | Container orchestration |
| Admin Dashboard | `websites/codex/InspireCodex.com/public/services.html` | UI controls |
| InspireCodex API Core | `websites/codex/InspireCodex.com/server.js` (health endpoints) | API stability |

### 2.2 Lock Exemptions
These modules are **EXEMPT from lock enforcement** because they evolve continuously:

| Category | Examples | Reason |
|----------|----------|--------|
| API Routes | `routes/*.js` | Business logic evolves |
| Database Migrations | `migrations/*.js` | Schema changes |
| Configuration | `*.json`, `.env` | Environment-dependent |
| Static Content | `public/*.html` (non-admin) | Content updates |
| Documentation | `*.md` (except .namespace) | Living documents |

---

## 3. FINGERPRINT SYSTEM

### 3.1 Calculation Method
```javascript
// Deterministic fingerprint calculation
const crypto = require('crypto');
const fs = require('fs');

function getModuleFingerprint(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Normalize: remove trailing whitespace, normalize line endings
  const normalized = content
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}
```

### 3.2 Fingerprint Storage
Stored in `TEST_REGISTRY.json`:
```json
{
  "modules": [
    {
      "name": "inspire-service-manager",
      "path": "services/Inspire.8.0/inspire-service-manager.cjs",
      "version_hash": "sha256:a1b2c3d4e5f6g7h8",
      "test_suite": "tests/inspire-service-manager.test.cjs",
      "last_pass_time": "2026-01-18T12:00:00Z",
      "lock_status": "LOCKED",
      "lock_bound": true
    }
  ]
}
```

---

## 4. UNLOCK PROCESS

### 4.1 Request Format
Add entry to `UNLOCK_REQUESTS.json`:
```json
{
  "id": "UNLOCK-2026-0118-001",
  "module_name": "inspire-service-manager",
  "module_path": "services/Inspire.8.0/inspire-service-manager.cjs",
  "current_fingerprint": "sha256:a1b2c3d4e5f6g7h8",
  "requested_by": "developer_name",
  "timestamp": "2026-01-18T12:00:00Z",
  "reason": "Adding support for new service type",
  "expires": "2026-01-19T12:00:00Z",
  "status": "PENDING"
}
```

### 4.2 Approval Workflow
1. Developer creates unlock request
2. Project owner reviews reason
3. Owner updates `status` to "APPROVED"
4. Developer makes changes
5. Developer runs tests
6. If tests pass, status → "COMPLETED", module re-locks
7. If tests fail, must fix before re-lock

### 4.3 Status Values
| Status | Meaning |
|--------|---------|
| PENDING | Awaiting approval |
| APPROVED | Changes allowed until expiry |
| REJECTED | Request denied |
| COMPLETED | Changes done, module re-locked |
| EXPIRED | Unlock window passed |

---

## 5. ENFORCEMENT RULES

### 5.1 Pre-Commit Hook Logic
```javascript
// Pseudo-code for pre-commit check
for (each modifiedFile in stagedFiles) {
  const registry = loadTestRegistry();
  const module = registry.findByPath(modifiedFile);

  if (module && module.lock_bound && module.lock_status === 'LOCKED') {
    const unlockRequest = findValidUnlock(modifiedFile);

    if (!unlockRequest) {
      blockCommit(`Module ${modifiedFile} is LOCKED. Create unlock request.`);
    }

    if (unlockRequest.status !== 'APPROVED') {
      blockCommit(`Unlock request ${unlockRequest.id} not approved.`);
    }

    if (new Date(unlockRequest.expires) < new Date()) {
      blockCommit(`Unlock request ${unlockRequest.id} has expired.`);
    }
  }
}
```

### 5.2 CI Pipeline Logic
```yaml
lock-check:
  - Load TEST_REGISTRY.json
  - For each changed file:
    - Check if lock-bound
    - Check if currently LOCKED
    - Verify valid unlock request exists
    - Block merge if violations found

post-test:
  - If all tests pass:
    - Calculate new fingerprints for changed modules
    - Update TEST_REGISTRY.json with new hashes
    - Set lock_status to LOCKED
    - Close unlock requests with COMPLETED
```

---

## 6. AUTO-RELOCK MECHANISM

### 6.1 Trigger Conditions
Module automatically re-locks when:
1. All tests in test suite pass
2. No test failures in dependent modules
3. Fingerprint is updated in registry

### 6.2 Re-Lock Process
```
1. CI runs tests
2. All tests pass
3. Calculate new fingerprint
4. Update TEST_REGISTRY.json:
   - version_hash = new fingerprint
   - last_pass_time = now
   - lock_status = LOCKED
5. Close unlock request:
   - status = COMPLETED
6. Commit registry changes
```

---

## 7. VIOLATION RESPONSES

### 7.1 Pre-Commit Violations
```
ERROR: Lock violation detected
Module: services/Inspire.8.0/inspire-service-manager.cjs
Status: LOCKED
Fingerprint: sha256:a1b2c3d4e5f6g7h8

To modify this module:
1. Create unlock request in .namespace/testing/UNLOCK_REQUESTS.json
2. Wait for approval
3. Retry commit

Commit blocked.
```

### 7.2 CI Violations
```
FAILURE: Lock enforcement check failed

Violations:
- inspire-service-manager.cjs: LOCKED, no unlock request
- services.html: LOCKED, unlock request expired

Action Required:
- Create/renew unlock requests
- Push updated UNLOCK_REQUESTS.json
- Re-run pipeline
```

---

## 8. SPECIAL CASES

### 8.1 Emergency Override
For production emergencies only:
```json
{
  "id": "EMERGENCY-2026-0118-001",
  "module_path": "*",
  "reason": "Production outage - immediate fix required",
  "status": "EMERGENCY_APPROVED",
  "approved_by": "project_owner",
  "expires": "2026-01-18T14:00:00Z"
}
```

### 8.2 Bulk Unlock
For major refactoring:
```json
{
  "id": "BULK-2026-0118-001",
  "module_pattern": "services/Inspire.8.0/*",
  "reason": "Architecture refactor per ARCH-0050",
  "status": "APPROVED",
  "expires": "2026-01-25T00:00:00Z"
}
```

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-18 | Jubilee | Initial lock rules |
