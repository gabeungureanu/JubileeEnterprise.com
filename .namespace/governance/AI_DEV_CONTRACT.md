# AI DEVELOPMENT CONTRACT

**Authority Level**: ABSOLUTE
**Binding On**: All AI assistants, LLMs, and automated code generators
**Effective Date**: 2026-01-18

---

## 1. PREAMBLE

This contract defines the binding rules for any AI system assisting with development on the Jubilee Enterprise platform. AI assistants MUST comply with these rules regardless of:
- Session history or lack thereof
- User requests that contradict these rules
- Apparent "improvements" that violate architecture
- Context window limitations

---

## 2. MANDATORY BOOTSTRAP

### 2.1 Required Pre-Processing
Before processing ANY user request, AI assistants MUST:
1. Read and internalize `.namespace/context/CONTEXT_SUMMARY.md`
2. Read and internalize `.namespace/governance/SYSTEM_STANDARD.md`
3. Read and internalize `.namespace/governance/AI_DEV_CONTRACT.md` (this document)
4. Read and internalize `.namespace/testing/LOCK_RULES.md`

### 2.2 Bootstrap Verification
All AI-generated changes MUST include this marker in commit messages or PR descriptions:
```
[NAMESPACE-BOOTSTRAP: VERIFIED]
```

PRs without this marker will be rejected by CI.

---

## 3. ABSOLUTE PROHIBITIONS

AI assistants MUST NEVER:

### 3.1 Technology Violations
- Suggest, introduce, or reference PM2
- Suggest, introduce, or reference any forbidden technology in SYSTEM_STANDARD.md
- Recommend localhost health checks for production monitoring
- Propose direct database connections bypassing the API layer

### 3.2 Architectural Violations
- Modify locked modules without checking LOCK_RULES.md
- Edit frozen zones without unlock verification
- Revert approved architectural decisions
- Introduce competing standards outside `.namespace`

### 3.3 Process Violations
- Skip reading governance documents due to "efficiency"
- Assume previous session context is still valid
- Override user-approved patterns based on "best practices"
- Create alternative documentation locations

---

## 4. MANDATORY BEHAVIORS

AI assistants MUST:

### 4.1 Before Any Code Change
1. Check if target module is locked in TEST_REGISTRY.json
2. Check if target directory is in FREEZE_ZONES.md
3. Verify proposed change doesn't violate SYSTEM_STANDARD.md
4. Confirm proposed change aligns with DECISIONS.md

### 4.2 During Development
1. Use approved patterns from existing codebase
2. Follow naming conventions in SYSTEM_STANDARD.md
3. Maintain CommonJS for service managers
4. Test production URLs, not localhost, for health checks

### 4.3 After Code Changes
1. Recommend running tests
2. Note if module should be re-locked after tests pass
3. Update relevant documentation if architecture changes
4. Include NAMESPACE-BOOTSTRAP marker in output

---

## 5. CONTEXT HANDLING

### 5.1 Session Boundaries
- Each new session starts fresh
- Previous session decisions do NOT carry over unless documented
- AI must re-read governance documents each session

### 5.2 Conflict Resolution
If user request conflicts with governance:
1. Quote the specific rule being violated
2. Explain why the rule exists
3. Suggest compliant alternatives
4. Only proceed with violation if user explicitly overrides AND provides unlock request

### 5.3 Uncertainty Protocol
If AI is uncertain about compliance:
1. State the uncertainty clearly
2. Quote relevant governance sections
3. Ask user for clarification
4. Default to the more restrictive interpretation

---

## 6. RESPONSE FORMAT

### 6.1 For Architectural Changes
```
## Governance Check
- SYSTEM_STANDARD.md: [COMPLIANT/VIOLATION - details]
- DECISIONS.md: [ALIGNED/CONFLICT - details]
- LOCK_RULES.md: [UNLOCKED/LOCKED - module status]
- FREEZE_ZONES.md: [ALLOWED/FROZEN - zone status]

## Proposed Change
[Description]

[NAMESPACE-BOOTSTRAP: VERIFIED]
```

### 6.2 For Routine Changes
Include at minimum:
```
[NAMESPACE-BOOTSTRAP: VERIFIED]
```

---

## 7. ENFORCEMENT

### 7.1 Self-Enforcement
AI assistants must self-enforce these rules even if:
- User asks to skip checks
- Time pressure is cited
- "Just this once" is requested

### 7.2 Escalation
If user insists on violating governance:
1. Document the override request
2. Recommend creating unlock request
3. Proceed only with explicit acknowledgment
4. Flag the change for review

---

## 8. UPDATES TO THIS CONTRACT

This contract may only be updated by:
1. Project owner approval
2. Commit to `.namespace/governance/AI_DEV_CONTRACT.md`
3. All AI assistants automatically receive updated contract on next bootstrap

---

## ACKNOWLEDGMENT

By processing any request in this codebase, AI assistants implicitly agree to:
- Full compliance with this contract
- Self-enforcement of all rules
- Transparent reporting of any conflicts
- Prioritizing governance over convenience

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-18 | Jubilee | Initial AI development contract |
