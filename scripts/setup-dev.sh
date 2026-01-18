#!/bin/bash
#
# Developer Environment Setup Script (Bash/Unix)
#
# Sets up the development environment with required hooks and validates
# the namespace governance system is properly configured.
#
# Run this script once after cloning the repository.
# Requires: Node.js 18+, Git
#
# Usage: ./scripts/setup-dev.sh [--force] [--skip-hooks]

set -e

FORCE=false
SKIP_HOOKS=false

for arg in "$@"; do
    case $arg in
        --force)
            FORCE=true
            shift
            ;;
        --skip-hooks)
            SKIP_HOOKS=true
            shift
            ;;
    esac
done

echo ""
echo "============================================================"
echo "  Jubilee Enterprise Developer Setup"
echo "============================================================"
echo ""

# Get repository root
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Repository: $REPO_ROOT"
echo ""

# ============================================
# PREREQUISITES CHECK
# ============================================

echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "ERROR: Node.js $NODE_VERSION is too old. Requires 18+"
    exit 1
fi

echo "  Node.js: $NODE_VERSION"

# Check Git
if ! command -v git &> /dev/null; then
    echo "ERROR: Git is not installed"
    exit 1
fi

GIT_VERSION=$(git --version)
echo "  Git: $GIT_VERSION"

# ============================================
# NAMESPACE VALIDATION
# ============================================

echo ""
echo "Validating namespace structure..."

REQUIRED_FILES=(
    ".namespace/governance/SYSTEM_STANDARD.md"
    ".namespace/governance/DECISIONS.md"
    ".namespace/governance/AI_DEV_CONTRACT.md"
    ".namespace/governance/FREEZE_ZONES.md"
    ".namespace/context/CONTEXT_SUMMARY.md"
    ".namespace/context/AI_BOOTSTRAP.md"
    ".namespace/testing/TEST_POLICY.md"
    ".namespace/testing/LOCK_RULES.md"
    ".namespace/testing/TEST_REGISTRY.json"
    ".namespace/enforcement/precommit.rules"
    ".namespace/enforcement/ci.rules"
    ".namespace/enforcement/check-namespace.cjs"
)

MISSING=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$REPO_ROOT/$file" ]; then
        MISSING+=("$file")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "ERROR: Missing namespace files:"
    for file in "${MISSING[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Please pull latest changes: git pull origin main"
    exit 1
fi

echo "  All namespace files present"

# ============================================
# GIT HOOKS INSTALLATION
# ============================================

if [ "$SKIP_HOOKS" = false ]; then
    echo ""
    echo "Installing Git hooks..."

    HOOKS_DIR="$REPO_ROOT/.git/hooks"

    if [ ! -d "$HOOKS_DIR" ]; then
        echo "ERROR: .git/hooks directory not found"
        echo "Is this a valid Git repository?"
        exit 1
    fi

    # Pre-commit hook
    PRE_COMMIT="$HOOKS_DIR/pre-commit"
    PRE_COMMIT_CONTENT='#!/bin/sh
# Namespace Enforcement Pre-Commit Hook
# Auto-installed by scripts/setup-dev.sh

echo "Running namespace enforcement check..."
node .namespace/enforcement/check-namespace.cjs precommit

if [ $? -ne 0 ]; then
    echo ""
    echo "Commit blocked due to governance violations."
    echo "See .namespace/ for rules and create unlock requests if needed."
    exit 1
fi'

    if [ -f "$PRE_COMMIT" ] && [ "$FORCE" = false ]; then
        echo "  Pre-commit hook exists (use --force to overwrite)"
    else
        echo "$PRE_COMMIT_CONTENT" > "$PRE_COMMIT"
        chmod +x "$PRE_COMMIT"
        echo "  Pre-commit hook installed"
    fi

    # Pre-push hook
    PRE_PUSH="$HOOKS_DIR/pre-push"
    PRE_PUSH_CONTENT='#!/bin/sh
# Namespace Enforcement Pre-Push Hook
# Auto-installed by scripts/setup-dev.sh

echo "Running namespace enforcement check before push..."
node .namespace/enforcement/check-namespace.cjs ci

if [ $? -ne 0 ]; then
    echo ""
    echo "Push blocked due to governance violations."
    exit 1
fi'

    if [ -f "$PRE_PUSH" ] && [ "$FORCE" = false ]; then
        echo "  Pre-push hook exists (use --force to overwrite)"
    else
        echo "$PRE_PUSH_CONTENT" > "$PRE_PUSH"
        chmod +x "$PRE_PUSH"
        echo "  Pre-push hook installed"
    fi
fi

# ============================================
# CLAUDE.MD VALIDATION
# ============================================

echo ""
echo "Checking CLAUDE.md integration..."

if [ -f "$REPO_ROOT/CLAUDE.md" ]; then
    if ! grep -q ".namespace" "$REPO_ROOT/CLAUDE.md"; then
        echo "  WARNING: CLAUDE.md may not reference .namespace governance"
        echo "  Consider adding namespace bootstrap instructions"
    else
        echo "  CLAUDE.md includes namespace references"
    fi
else
    echo "  WARNING: CLAUDE.md not found"
fi

# ============================================
# SUMMARY
# ============================================

echo ""
echo "============================================================"
echo "  Setup Complete"
echo "============================================================"
echo ""
echo "Governance files are in: .namespace/"
echo ""
echo "Key documents to read:"
echo "  - .namespace/context/CONTEXT_SUMMARY.md    (quick reference)"
echo "  - .namespace/governance/SYSTEM_STANDARD.md (rules)"
echo "  - .namespace/testing/LOCK_RULES.md         (locking)"
echo ""
echo "Pre-commit hooks will enforce governance automatically."
echo ""
