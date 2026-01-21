#!/bin/bash
# =============================================================================
# INSPIRE 8.0 WSL ENVIRONMENT SETUP
# =============================================================================
# This script installs and configures the runtime, tooling, and support
# dependencies required to execute the Inspire 8.0 pipeline inside WSL.
#
# PREREQUISITES:
# - WSL2 with Ubuntu 22.04 or later
# - Qdrant installed natively (accessible on localhost:6333)
# - PostgreSQL available with codex database
#
# USAGE:
#   chmod +x setup_wsl.sh
#   ./setup_wsl.sh
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
VENV_NAME="inspire_venv"
VENV_PATH="$PIPELINE_DIR/$VENV_NAME"
PYTHON_VERSION="3.11"
LOG_FILE="$PIPELINE_DIR/logs/setup/wsl_setup_$(date +%Y%m%d_%H%M%S).log"

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
echo "  INSPIRE 8.0 WSL ENVIRONMENT SETUP"
echo "============================================================"
echo ""
log_info "Starting WSL environment setup..."
log_info "Log file: $LOG_FILE"
echo ""

# =============================================================================
# STEP 1: SYSTEM UPDATE
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 1: Updating system packages"
echo "------------------------------------------------------------"

log_info "Updating apt package lists..."
sudo apt-get update -qq

log_info "Upgrading existing packages..."
sudo apt-get upgrade -y -qq

log_success "System packages updated"
echo ""

# =============================================================================
# STEP 2: INSTALL CORE SYSTEM UTILITIES
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 2: Installing core system utilities"
echo "------------------------------------------------------------"

CORE_PACKAGES=(
    "git"                 # Version control and changelog management
    "curl"                # Service health checks
    "wget"                # File downloads
    "jq"                  # JSON processing
    "build-essential"     # Compiling native dependencies
    "ca-certificates"     # SSL certificates
    "gnupg"               # GPG for package signing
    "lsb-release"         # Linux Standard Base info
    "software-properties-common"  # Add PPAs
)

log_info "Installing core packages: ${CORE_PACKAGES[*]}"

for package in "${CORE_PACKAGES[@]}"; do
    if dpkg -l | grep -q "^ii  $package "; then
        log_info "$package is already installed"
    else
        log_info "Installing $package..."
        sudo apt-get install -y -qq "$package"
    fi
done

log_success "Core system utilities installed"
echo ""

# =============================================================================
# STEP 3: INSTALL YQ FOR YAML PROCESSING
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 3: Installing yq for YAML processing"
echo "------------------------------------------------------------"

if check_command yq; then
    log_info "yq is already installed: $(yq --version)"
else
    log_info "Installing yq..."
    YQ_VERSION="v4.40.5"
    sudo wget -qO /usr/local/bin/yq "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64"
    sudo chmod +x /usr/local/bin/yq
    log_success "yq installed: $(yq --version)"
fi

echo ""

# =============================================================================
# STEP 4: INSTALL PYTHON 3
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 4: Installing Python 3"
echo "------------------------------------------------------------"

PYTHON_PACKAGES=(
    "python3"
    "python3-pip"
    "python3-venv"
    "python3-dev"
    "python3-setuptools"
    "python3-wheel"
)

log_info "Installing Python packages: ${PYTHON_PACKAGES[*]}"

for package in "${PYTHON_PACKAGES[@]}"; do
    if dpkg -l | grep -q "^ii  $package "; then
        log_info "$package is already installed"
    else
        log_info "Installing $package..."
        sudo apt-get install -y -qq "$package"
    fi
done

# Verify Python version
PYTHON_INSTALLED=$(python3 --version 2>&1)
log_success "Python installed: $PYTHON_INSTALLED"
echo ""

# =============================================================================
# STEP 5: INSTALL POSTGRESQL CLIENT
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 5: Installing PostgreSQL client"
echo "------------------------------------------------------------"

POSTGRES_PACKAGES=(
    "postgresql-client"
    "libpq-dev"           # Required for psycopg2 compilation
)

log_info "Installing PostgreSQL packages: ${POSTGRES_PACKAGES[*]}"

for package in "${POSTGRES_PACKAGES[@]}"; do
    if dpkg -l | grep -q "^ii  $package "; then
        log_info "$package is already installed"
    else
        log_info "Installing $package..."
        sudo apt-get install -y -qq "$package"
    fi
done

log_success "PostgreSQL client installed"
echo ""

# =============================================================================
# STEP 6: CREATE PYTHON VIRTUAL ENVIRONMENT
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 6: Creating Python virtual environment"
echo "------------------------------------------------------------"

if [ -d "$VENV_PATH" ]; then
    log_warning "Virtual environment already exists at: $VENV_PATH"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Removing existing virtual environment..."
        rm -rf "$VENV_PATH"
    else
        log_info "Keeping existing virtual environment"
    fi
fi

if [ ! -d "$VENV_PATH" ]; then
    log_info "Creating virtual environment at: $VENV_PATH"
    python3 -m venv "$VENV_PATH"
    log_success "Virtual environment created"
fi

# Activate virtual environment
log_info "Activating virtual environment..."
source "$VENV_PATH/bin/activate"

# Upgrade pip in virtual environment
log_info "Upgrading pip..."
pip install --upgrade pip setuptools wheel -q

log_success "Virtual environment ready"
echo ""

# =============================================================================
# STEP 7: INSTALL PYTHON DEPENDENCIES
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 7: Installing Python dependencies"
echo "------------------------------------------------------------"

REQUIREMENTS_FILE="$SCRIPT_DIR/requirements.txt"

if [ -f "$REQUIREMENTS_FILE" ]; then
    log_info "Installing from requirements.txt..."
    pip install -r "$REQUIREMENTS_FILE" -q
else
    log_warning "requirements.txt not found, installing core dependencies..."

    # Core pipeline dependencies
    PYTHON_DEPS=(
        # Qdrant client for vector database access
        "qdrant-client>=1.7.0"

        # PostgreSQL connectivity
        "psycopg2-binary>=2.9.9"

        # OpenAI SDK for embeddings and execution
        "openai>=1.12.0"

        # Token counting for chunking
        "tiktoken>=0.5.2"

        # YAML processing for pipeline manifests
        "PyYAML>=6.0.1"

        # HTTP requests
        "requests>=2.31.0"
        "httpx>=0.26.0"

        # Data validation
        "pydantic>=2.5.0"

        # Environment management
        "python-dotenv>=1.0.0"

        # Async support
        "aiohttp>=3.9.0"

        # Logging and utilities
        "structlog>=24.1.0"
        "rich>=13.7.0"

        # Testing
        "pytest>=7.4.0"
        "pytest-asyncio>=0.23.0"
    )

    for dep in "${PYTHON_DEPS[@]}"; do
        log_info "Installing $dep..."
        pip install "$dep" -q
    done
fi

log_success "Python dependencies installed"
echo ""

# =============================================================================
# STEP 8: CREATE ACTIVATION SCRIPT
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 8: Creating activation script"
echo "------------------------------------------------------------"

ACTIVATE_SCRIPT="$PIPELINE_DIR/activate_inspire.sh"

cat > "$ACTIVATE_SCRIPT" << 'ACTIVATE_EOF'
#!/bin/bash
# =============================================================================
# INSPIRE 8.0 ENVIRONMENT ACTIVATION
# =============================================================================
# Source this script to activate the Inspire 8.0 pipeline environment.
#
# USAGE:
#   source activate_inspire.sh
#
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$SCRIPT_DIR/inspire_venv"

# Check if virtual environment exists
if [ ! -d "$VENV_PATH" ]; then
    echo "[ERROR] Virtual environment not found at: $VENV_PATH"
    echo "Please run setup_wsl.sh first."
    return 1
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Set environment variables
export INSPIRE_PIPELINE_DIR="$SCRIPT_DIR"
export INSPIRE_ENV="production"
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Load .env file if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    echo "[INFO] Loaded environment from .env"
fi

echo ""
echo "============================================================"
echo "  INSPIRE 8.0 PIPELINE ENVIRONMENT ACTIVATED"
echo "============================================================"
echo "  Virtual Environment: $VENV_PATH"
echo "  Pipeline Directory:  $SCRIPT_DIR"
echo "  Python Version:      $(python --version)"
echo "============================================================"
echo ""
echo "Run 'deactivate' to exit the environment."
echo ""
ACTIVATE_EOF

chmod +x "$ACTIVATE_SCRIPT"
log_success "Activation script created: $ACTIVATE_SCRIPT"
echo ""

# =============================================================================
# STEP 9: VERIFY INSTALLATION
# =============================================================================

echo "------------------------------------------------------------"
echo "Step 9: Verifying installation"
echo "------------------------------------------------------------"

# Verify core commands
COMMANDS_TO_CHECK=(
    "git"
    "curl"
    "jq"
    "yq"
    "python3"
    "pip"
)

all_passed=true
for cmd in "${COMMANDS_TO_CHECK[@]}"; do
    if check_command "$cmd"; then
        version=$($cmd --version 2>&1 | head -n 1)
        log_success "$cmd: $version"
    else
        log_error "$cmd: NOT FOUND"
        all_passed=false
    fi
done

# Verify Python packages
echo ""
log_info "Verifying Python packages..."

PACKAGES_TO_CHECK=(
    "qdrant_client"
    "psycopg2"
    "openai"
    "tiktoken"
    "yaml"
    "pydantic"
)

for pkg in "${PACKAGES_TO_CHECK[@]}"; do
    if python -c "import $pkg" 2>/dev/null; then
        log_success "Python package '$pkg': OK"
    else
        log_error "Python package '$pkg': NOT FOUND"
        all_passed=false
    fi
done

echo ""

if $all_passed; then
    log_success "All verifications passed!"
else
    log_error "Some verifications failed. Please check the output above."
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo "============================================================"
echo "  SETUP COMPLETE"
echo "============================================================"
echo ""
echo "To activate the Inspire 8.0 environment, run:"
echo ""
echo "  source $ACTIVATE_SCRIPT"
echo ""
echo "To verify service connectivity, run:"
echo ""
echo "  python $SCRIPT_DIR/verify_services.py"
echo ""
echo "Log file: $LOG_FILE"
echo ""
echo "============================================================"

# Deactivate virtual environment
deactivate 2>/dev/null || true

exit 0
