# AI BOOTSTRAP SPECIFICATION

**Purpose**: Define the mandatory bootstrapping process for all AI-assisted development
**Authority**: ABSOLUTE - No AI session may bypass this process

---

## 1. BOOTSTRAP REQUIREMENTS

### 1.1 Mandatory Files
Every AI prompt MUST be prepended with the contents of:

1. `.namespace/context/CONTEXT_SUMMARY.md`
2. `.namespace/governance/SYSTEM_STANDARD.md`
3. `.namespace/governance/AI_DEV_CONTRACT.md`
4. `.namespace/testing/LOCK_RULES.md`

### 1.2 Load Order
Files must be loaded in the order specified above to ensure:
- Context summary provides quick orientation
- System standard establishes technical rules
- AI contract defines behavioral expectations
- Lock rules explain module protection

---

## 2. IMPLEMENTATION METHODS

### 2.1 Claude Code / CLI Wrapper
Use CLAUDE.md at repository root to inject governance:

```markdown
# In CLAUDE.md (already exists, add this section):

## Governance Bootstrap
Before any task, read and internalize:
- .namespace/context/CONTEXT_SUMMARY.md
- .namespace/governance/SYSTEM_STANDARD.md
- .namespace/governance/AI_DEV_CONTRACT.md
- .namespace/testing/LOCK_RULES.md

Include [NAMESPACE-BOOTSTRAP: VERIFIED] in all outputs.
```

### 2.2 VS Code Extension
Configure extension settings to auto-include governance:

```json
{
  "claude.contextFiles": [
    ".namespace/context/CONTEXT_SUMMARY.md",
    ".namespace/governance/SYSTEM_STANDARD.md",
    ".namespace/governance/AI_DEV_CONTRACT.md",
    ".namespace/testing/LOCK_RULES.md"
  ]
}
```

### 2.3 Custom AI Wrapper Script
Use `scripts/ai-prompt.ps1` or `scripts/ai-prompt.cjs`:

```powershell
# scripts/ai-prompt.ps1
param([string]$Prompt)

$contextSummary = Get-Content ".namespace/context/CONTEXT_SUMMARY.md" -Raw
$systemStandard = Get-Content ".namespace/governance/SYSTEM_STANDARD.md" -Raw
$aiContract = Get-Content ".namespace/governance/AI_DEV_CONTRACT.md" -Raw
$lockRules = Get-Content ".namespace/testing/LOCK_RULES.md" -Raw

$bootstrappedPrompt = @"
# GOVERNANCE BOOTSTRAP (Auto-Prepended)

$contextSummary

---

$systemStandard

---

$aiContract

---

$lockRules

---

# USER REQUEST
$Prompt
"@

# Send to AI service
$bootstrappedPrompt | clip
Write-Host "Bootstrapped prompt copied to clipboard"
```

---

## 3. VERIFICATION REQUIREMENTS

### 3.1 Output Marker
All AI-generated outputs must include:
```
[NAMESPACE-BOOTSTRAP: VERIFIED]
```

### 3.2 CI Enforcement
PRs with AI-generated changes must include the marker.
CI checks for marker presence in:
- Commit messages
- PR descriptions
- Code comments (for significant changes)

### 3.3 Rejection Criteria
Reject AI output that:
- Lacks bootstrap verification marker
- Proposes forbidden technologies
- Modifies locked modules without unlock
- Edits frozen zones without approval

---

## 4. BOOTSTRAP REFRESH

### 4.1 Session Boundaries
Bootstrap MUST be refreshed:
- At start of each new AI session
- After significant context window clearing
- When switching between major tasks
- If AI appears to have lost context

### 4.2 Refresh Indicators
Re-bootstrap if AI:
- Suggests PM2 or other forbidden tech
- Proposes localhost health checks
- Forgets about Windows Service architecture
- Ignores module lock status

---

## 5. BOOTSTRAP FAILURE HANDLING

### 5.1 Detection
Bootstrap failure is indicated by:
- Missing verification marker
- Governance-violating suggestions
- Confusion about project architecture

### 5.2 Recovery
1. Stop current task
2. Explicitly re-read all governance files
3. Confirm understanding with AI
4. Resume task with fresh context

### 5.3 Logging
Log bootstrap failures in:
`.namespace/logs/bootstrap-failures.log`

Format:
```
[2026-01-18T12:00:00Z] BOOTSTRAP_FAILURE
Session: <session_id>
Indicator: Suggested PM2
Action: Re-bootstrapped
```

---

## 6. AUTOMATION INTEGRATION

### 6.1 Pre-Commit Hook
```bash
# Check for NAMESPACE-BOOTSTRAP marker in commits with AI-generated code
if git diff --cached --name-only | grep -q "\.js\|\.cjs\|\.ts"; then
  if ! git log -1 --format=%B | grep -q "NAMESPACE-BOOTSTRAP: VERIFIED"; then
    echo "WARNING: AI-generated code changes should include bootstrap marker"
  fi
fi
```

### 6.2 CI Pipeline
```yaml
# .github/workflows/namespace-check.yml
- name: Check Bootstrap Marker
  run: |
    if echo "${{ github.event.pull_request.body }}" | grep -q "AI-generated\|Claude\|GPT"; then
      if ! echo "${{ github.event.pull_request.body }}" | grep -q "NAMESPACE-BOOTSTRAP: VERIFIED"; then
        echo "::error::AI-assisted PR must include NAMESPACE-BOOTSTRAP: VERIFIED marker"
        exit 1
      fi
    fi
```

---

## 7. MAINTENANCE

### 7.1 Updating Bootstrap Files
When governance files change:
1. Update the source file in `.namespace/`
2. Notify all developers to refresh their AI sessions
3. Update version in affected file
4. Consider adding to DECISIONS.md if significant

### 7.2 Adding New Bootstrap Files
To add a new mandatory bootstrap file:
1. Create file in appropriate `.namespace/` directory
2. Update this document's "Mandatory Files" section
3. Update all wrapper scripts
4. Update CI checks

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-18 | Jubilee | Initial bootstrap specification |
