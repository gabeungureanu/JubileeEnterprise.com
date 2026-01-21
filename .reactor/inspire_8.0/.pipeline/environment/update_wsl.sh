#!/bin/bash
# =============================================================================
# INSPIRE 8.0 WSL ENVIRONMENT UPDATE
# =============================================================================
# This script updates the existing WSL environment with dependencies required
# for the Inspire 8.0 pipeline execution.
#
# PREREQUISITES:
# - WSL2 with Ubuntu already configured
# - Python 3 already installed
# - Qdrant accessible on localhost:6333
# - PostgreSQL available with codex database
#
# USAGE:
#   chmod +x update_wsl.sh
#   ./update_wsl.sh
#
# Author: Jubilee Enterprise
# Version: 1.0.0
# =============================================================================

set -e  # Exit on error

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PIPELINE_DIR/logs/setup/wsl_update_$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    log "INFO" "$1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    log "SUCCESS" "$1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    log "WARNING" "$1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log "ERROR" "$1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# SETUP LOG DIRECTORY
# =============================================================================

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

echo ""
echo "============================================================"
echo "  INSPIRE 8.0 WSL ENVIRONMENT UPDATE"
echo "============================================================"
echo ""
log_info "Starting WSL environment update..."
log_info "Log file: $LOG_FILE"
echo ""

# =============================================================================
# STEP 1: VERIFY EXISTING ENVIRONMENT
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 1: Verifying existing environment"
echo "------------------------------------------------------------"

# Check Python
if check_command python3; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    log_success "Python found: $PYTHON_VERSION"
else
    log_error "Python3 not found. Please install Python first."
    exit 1
fi

# Check pip
if check_command pip3; then
    PIP_VERSION=$(pip3 --version 2>&1)
    log_success "pip found: $PIP_VERSION"
else
    log_warning "pip3 not found, attempting to install..."
    sudo apt-get update -qq && sudo apt-get install -y -qq python3-pip
fi

echo ""

# =============================================================================
# STEP 2: INSTALL MISSING SYSTEM PACKAGES
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 2: Checking/installing system packages"
echo "------------------------------------------------------------"

SYSTEM_PACKAGES=(
    "jq"                  # JSON processing
    "libpq-dev"           # Required for psycopg2
    "python3-dev"         # Python development headers
)

for package in "${SYSTEM_PACKAGES[@]}"; do
    if dpkg -l | grep -q "^ii  $package "; then
        log_info "$package: already installed"
    else
        log_info "Installing $package..."
        sudo apt-get update -qq && sudo apt-get install -y -qq "$package"
        log_success "$package: installed"
    fi
done

# Check for yq
if check_command yq; then
    log_info "yq: already installed ($(yq --version 2>&1 | head -1))"
else
    log_info "Installing yq..."
    YQ_VERSION="v4.40.5"
    sudo wget -qO /usr/local/bin/yq "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64"
    sudo chmod +x /usr/local/bin/yq
    log_success "yq: installed"
fi

echo ""

# =============================================================================
# STEP 3: INSTALL PYTHON DEPENDENCIES
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 3: Installing Python dependencies"
echo "------------------------------------------------------------"

# Core pipeline dependencies
PYTHON_DEPS=(
    "qdrant-client>=1.7.0"
    "psycopg2-binary>=2.9.9"
    "openai>=1.12.0"
    "tiktoken>=0.5.2"
    "PyYAML>=6.0.1"
    "requests>=2.31.0"
    "httpx>=0.26.0"
    "pydantic>=2.5.0"
    "python-dotenv>=1.0.0"
    "aiohttp>=3.9.0"
    "structlog>=24.1.0"
    "rich>=13.7.0"
    "tenacity>=8.2.0"
    "tqdm>=4.66.0"
    "numpy>=1.26.0"
)

log_info "Installing/upgrading Python packages..."

for dep in "${PYTHON_DEPS[@]}"; do
    package_name=$(echo "$dep" | sed 's/[<>=].*//')
    log_info "  Installing $package_name..."
    pip3 install --user "$dep" -q 2>/dev/null || pip3 install --user "$dep"
done

log_success "Python dependencies installed"
echo ""

# =============================================================================
# STEP 4: VERIFY INSTALLATIONS
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 4: Verifying installations"
echo "------------------------------------------------------------"

# Verify Python packages
PACKAGES_TO_CHECK=(
    "qdrant_client"
    "psycopg2"
    "openai"
    "tiktoken"
    "yaml"
    "pydantic"
    "requests"
    "dotenv"
)

all_passed=true
for pkg in "${PACKAGES_TO_CHECK[@]}"; do
    if python3 -c "import $pkg" 2>/dev/null; then
        log_success "Python package '$pkg': OK"
    else
        log_error "Python package '$pkg': MISSING"
        all_passed=false
    fi
done

echo ""

# =============================================================================
# STEP 5: TEST SERVICE CONNECTIVITY
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 5: Testing service connectivity"
echo "------------------------------------------------------------"

# Test Qdrant
log_info "Testing Qdrant connection..."
QDRANT_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:6333/ 2>/dev/null || echo "000")
if [ "$QDRANT_RESULT" == "200" ]; then
    log_success "Qdrant: reachable on localhost:6333"
else
    log_warning "Qdrant: not reachable (HTTP $QDRANT_RESULT) - ensure Qdrant is running"
fi

# Test InspireCodex API
log_info "Testing InspireCodex API..."
CODEX_RESULT=$(curl -s -o /dev/null -w "%{http_code}" https://www.inspirecodex.com/ 2>/dev/null || echo "000")
if [ "$CODEX_RESULT" == "200" ] || [ "$CODEX_RESULT" == "301" ] || [ "$CODEX_RESULT" == "302" ]; then
    log_success "InspireCodex API: reachable"
else
    log_warning "InspireCodex API: not reachable (HTTP $CODEX_RESULT)"
fi

echo ""

# =============================================================================
# STEP 6: CREATE/UPDATE ENVIRONMENT FILE
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 6: Environment configuration"
echo "------------------------------------------------------------"

ENV_FILE="$PIPELINE_DIR/.env"
ENV_TEMPLATE="$SCRIPT_DIR/.env.template"

if [ -f "$ENV_FILE" ]; then
    log_info ".env file exists at: $ENV_FILE"
else
    if [ -f "$ENV_TEMPLATE" ]; then
        log_info "Creating .env from template..."
        cp "$ENV_TEMPLATE" "$ENV_FILE"
        log_success ".env created - please configure with your credentials"
    else
        log_warning ".env.template not found - please create .env manually"
    fi
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo "============================================================"
echo "  UPDATE COMPLETE"
echo "============================================================"
echo ""

if $all_passed; then
    log_success "All Python dependencies verified!"
else
    log_warning "Some dependencies may need manual installation"
fi

echo ""
echo "NEXT STEPS:"
echo "  1. Configure credentials in: $ENV_FILE"
echo "  2. Verify services: python3 $SCRIPT_DIR/verify_services.py"
echo "  3. Validate environment: python3 $SCRIPT_DIR/validate_environment.py"
echo ""
echo "Log file: $LOG_FILE"
echo ""
echo "============================================================"

exit 0
