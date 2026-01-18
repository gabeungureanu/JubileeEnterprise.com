<#
.SYNOPSIS
    Developer Environment Setup Script

.DESCRIPTION
    Sets up the development environment with required hooks and validates
    the namespace governance system is properly configured.

.NOTES
    Run this script once after cloning the repository.
    Requires: Node.js 18+, Git

.EXAMPLE
    .\scripts\setup-dev.ps1
#>

param(
    [switch]$Force,
    [switch]$SkipHooks
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "  Jubilee Enterprise Developer Setup" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Get repository root
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

Write-Host "Repository: $RepoRoot" -ForegroundColor Gray
Write-Host ""

# ============================================
# PREREQUISITES CHECK
# ============================================

Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
$NodeVersion = $null
try {
    $NodeVersion = (node --version 2>$null)
} catch { }

if (-not $NodeVersion) {
    Write-Host "ERROR: Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

$NodeMajor = [int]($NodeVersion -replace 'v(\d+)\..*', '$1')
if ($NodeMajor -lt 18) {
    Write-Host "ERROR: Node.js $NodeVersion is too old. Requires 18+" -ForegroundColor Red
    exit 1
}

Write-Host "  Node.js: $NodeVersion" -ForegroundColor Green

# Check Git
$GitVersion = $null
try {
    $GitVersion = (git --version 2>$null)
} catch { }

if (-not $GitVersion) {
    Write-Host "ERROR: Git is not installed" -ForegroundColor Red
    exit 1
}

Write-Host "  Git: $GitVersion" -ForegroundColor Green

# ============================================
# NAMESPACE VALIDATION
# ============================================

Write-Host ""
Write-Host "Validating namespace structure..." -ForegroundColor Yellow

$RequiredFiles = @(
    ".namespace/governance/SYSTEM_STANDARD.md",
    ".namespace/governance/DECISIONS.md",
    ".namespace/governance/AI_DEV_CONTRACT.md",
    ".namespace/governance/FREEZE_ZONES.md",
    ".namespace/context/CONTEXT_SUMMARY.md",
    ".namespace/context/AI_BOOTSTRAP.md",
    ".namespace/testing/TEST_POLICY.md",
    ".namespace/testing/LOCK_RULES.md",
    ".namespace/testing/TEST_REGISTRY.json",
    ".namespace/enforcement/precommit.rules",
    ".namespace/enforcement/ci.rules",
    ".namespace/enforcement/check-namespace.cjs"
)

$MissingFiles = @()
foreach ($file in $RequiredFiles) {
    $fullPath = Join-Path $RepoRoot $file
    if (-not (Test-Path $fullPath)) {
        $MissingFiles += $file
    }
}

if ($MissingFiles.Count -gt 0) {
    Write-Host "ERROR: Missing namespace files:" -ForegroundColor Red
    foreach ($file in $MissingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please pull latest changes: git pull origin main" -ForegroundColor Yellow
    exit 1
}

Write-Host "  All namespace files present" -ForegroundColor Green

# ============================================
# GIT HOOKS INSTALLATION
# ============================================

if (-not $SkipHooks) {
    Write-Host ""
    Write-Host "Installing Git hooks..." -ForegroundColor Yellow

    $HooksDir = Join-Path $RepoRoot ".git/hooks"

    if (-not (Test-Path $HooksDir)) {
        Write-Host "ERROR: .git/hooks directory not found" -ForegroundColor Red
        Write-Host "Is this a valid Git repository?" -ForegroundColor Red
        exit 1
    }

    # Pre-commit hook
    $PreCommitHook = Join-Path $HooksDir "pre-commit"
    $PreCommitContent = @'
#!/bin/sh
# Namespace Enforcement Pre-Commit Hook
# Auto-installed by scripts/setup-dev.ps1

echo "Running namespace enforcement check..."
node .namespace/enforcement/check-namespace.cjs precommit

if [ $? -ne 0 ]; then
    echo ""
    echo "Commit blocked due to governance violations."
    echo "See .namespace/ for rules and create unlock requests if needed."
    exit 1
fi
'@

    if ((Test-Path $PreCommitHook) -and (-not $Force)) {
        Write-Host "  Pre-commit hook exists (use -Force to overwrite)" -ForegroundColor Yellow
    } else {
        $PreCommitContent | Out-File -FilePath $PreCommitHook -Encoding utf8 -NoNewline
        Write-Host "  Pre-commit hook installed" -ForegroundColor Green
    }

    # Pre-push hook
    $PrePushHook = Join-Path $HooksDir "pre-push"
    $PrePushContent = @'
#!/bin/sh
# Namespace Enforcement Pre-Push Hook
# Auto-installed by scripts/setup-dev.ps1

echo "Running namespace enforcement check before push..."
node .namespace/enforcement/check-namespace.cjs ci

if [ $? -ne 0 ]; then
    echo ""
    echo "Push blocked due to governance violations."
    exit 1
fi
'@

    if ((Test-Path $PrePushHook) -and (-not $Force)) {
        Write-Host "  Pre-push hook exists (use -Force to overwrite)" -ForegroundColor Yellow
    } else {
        $PrePushContent | Out-File -FilePath $PrePushHook -Encoding utf8 -NoNewline
        Write-Host "  Pre-push hook installed" -ForegroundColor Green
    }
}

# ============================================
# CLAUDE.MD VALIDATION
# ============================================

Write-Host ""
Write-Host "Checking CLAUDE.md integration..." -ForegroundColor Yellow

$ClaudeMd = Join-Path $RepoRoot "CLAUDE.md"
if (Test-Path $ClaudeMd) {
    $ClaudeContent = Get-Content $ClaudeMd -Raw

    if ($ClaudeContent -notmatch "\.namespace") {
        Write-Host "  WARNING: CLAUDE.md may not reference .namespace governance" -ForegroundColor Yellow
        Write-Host "  Consider adding namespace bootstrap instructions" -ForegroundColor Yellow
    } else {
        Write-Host "  CLAUDE.md includes namespace references" -ForegroundColor Green
    }
} else {
    Write-Host "  WARNING: CLAUDE.md not found" -ForegroundColor Yellow
}

# ============================================
# SUMMARY
# ============================================

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "  Setup Complete" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "Governance files are in: .namespace/" -ForegroundColor Gray
Write-Host ""
Write-Host "Key documents to read:" -ForegroundColor White
Write-Host "  - .namespace/context/CONTEXT_SUMMARY.md    (quick reference)" -ForegroundColor Gray
Write-Host "  - .namespace/governance/SYSTEM_STANDARD.md (rules)" -ForegroundColor Gray
Write-Host "  - .namespace/testing/LOCK_RULES.md         (locking)" -ForegroundColor Gray
Write-Host ""
Write-Host "Pre-commit hooks will enforce governance automatically." -ForegroundColor Green
Write-Host ""
