# TEST POLICY

**Authority Level**: ABSOLUTE
**Purpose**: Define unit testing as a state transition mechanism for module locking
**Enforcement**: Automated via CI pipeline

---

## 1. TESTING PHILOSOPHY

### 1.1 Core Principle
**Unit testing is not just validation—it is a state transition mechanism.**

When a module passes all tests:
1. Its correctness is verified
2. Its behavior is documented (via test cases)
3. It becomes eligible for LOCKING
4. Further changes require explicit unlock

### 1.2 Test-Driven Locking
```
UNLOCKED + TESTS_PASS → LOCKED
LOCKED + UNLOCK_REQUEST → UNLOCKED
UNLOCKED + CHANGES + TESTS_PASS → LOCKED
```

---

## 2. TEST REQUIREMENTS

### 2.1 Coverage Targets
| Module Type | Minimum Coverage | Lock Eligible |
|-------------|-----------------|---------------|
| Core Services | 80% | Yes |
| API Endpoints | 70% | Yes |
| UI Components | 60% | Yes |
| Utilities | 90% | Yes |
| Configuration | N/A | No |

### 2.2 Test Types Required
| Type | Purpose | Required For |
|------|---------|--------------|
| Unit | Function-level | All lock-eligible code |
| Integration | Cross-module | API layers |
| Health Check | Service availability | Service managers |

### 2.3 Test File Naming
```
module.js        → module.test.js
module.cjs       → module.test.cjs
component.jsx    → component.test.jsx
```

---

## 3. LOCK-ELIGIBLE MODULES

### 3.1 Always Lock-Eligible
These modules MUST be locked after tests pass:

| Category | Examples |
|----------|----------|
| Service Managers | `inspire-service-manager.cjs` |
| Core API Handlers | `server.js` health endpoints |
| UI Admin Components | `services.html` control logic |
| Worker Controls | Worker scaling functions |

### 3.2 Never Lock-Eligible (Exempt)
These modules evolve continuously and are exempt from locking:

| Category | Reason |
|----------|--------|
| API Routes | Business logic evolves |
| Database Migrations | Schema changes continuously |
| Configuration Files | Environment-dependent |
| Static Assets | Content updates frequently |

---

## 4. TEST EXECUTION WORKFLOW

### 4.1 Local Development
```bash
# Run tests for a specific module
npm test -- --grep "inspire-service-manager"

# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
```

### 4.2 CI Pipeline
```yaml
test:
  - npm ci
  - npm test -- --coverage
  - npm run lock:update  # Update TEST_REGISTRY.json
```

### 4.3 Pre-Commit
```bash
# Tests run automatically if lock-eligible files changed
# Commit blocked if tests fail
```

---

## 5. TEST REGISTRY INTEGRATION

### 5.1 After Tests Pass
CI automatically updates `TEST_REGISTRY.json`:
```json
{
  "module": "inspire-service-manager.cjs",
  "path": "services/Inspire.8.0/inspire-service-manager.cjs",
  "version_hash": "sha256:abc123...",
  "test_suite": "services/Inspire.8.0/inspire-service-manager.test.cjs",
  "last_pass_time": "2026-01-18T12:00:00Z",
  "lock_status": "LOCKED"
}
```

### 5.2 Lock Status Values
| Status | Meaning |
|--------|---------|
| LOCKED | Module passed tests, changes blocked |
| UNLOCKED | Module can be modified |
| PENDING | Tests running, status uncertain |
| FAILED | Tests failed, must fix before lock |

---

## 6. FINGERPRINT CALCULATION

### 6.1 Algorithm
```javascript
const crypto = require('crypto');
const fs = require('fs');

function calculateFingerprint(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Normalize line endings and whitespace
  const normalized = content.replace(/\r\n/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

### 6.2 Fingerprint Storage
Stored in `TEST_REGISTRY.json` as `version_hash`

### 6.3 Verification
On commit, current fingerprint compared to stored fingerprint:
- Match + LOCKED = Block change
- Mismatch + UNLOCKED = Allow change
- Mismatch + LOCKED + Unlock Request = Allow change

---

## 7. TEST FAILURE HANDLING

### 7.1 Immediate Failures
When tests fail:
1. CI build fails
2. PR cannot be merged
3. Module status set to FAILED
4. Developer must fix before proceeding

### 7.2 Regression Detection
When previously-passing tests fail:
1. Alert generated
2. Module auto-unlocked
3. Investigation required
4. Must re-lock after fix

### 7.3 Flaky Test Policy
Flaky tests (intermittent failures):
1. Must be fixed or removed
2. Cannot be used for locking
3. Tracked in `TEST_REGISTRY.json` as `flaky: true`

---

## 8. SPECIAL CASES

### 8.1 Emergency Changes
For production emergencies:
1. Create emergency unlock request
2. Make fix (tests may be skipped initially)
3. Add tests retroactively
4. Re-lock with full test suite

### 8.2 Refactoring
For large refactors:
1. Unlock all affected modules
2. Make changes
3. Update tests as needed
4. All modules must pass before re-locking

### 8.3 New Modules
New modules:
1. Start as UNLOCKED
2. Write tests during development
3. First successful test run → auto-LOCK

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-18 | Jubilee | Initial test policy |
