# =============================================================================
# Development Environment Setup (Windows PowerShell)
# =============================================================================
# Complete setup script for new developers on Windows
# =============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "=============================================="
Write-Host "  Jubilee SSO - Development Setup"
Write-Host "=============================================="
Write-Host ""

Set-Location $ProjectRoot

# Check prerequisites
Write-Host "Checking prerequisites..."

try {
    $nodeVersion = (node -v).TrimStart('v').Split('.')[0]
    if ([int]$nodeVersion -lt 20) {
        throw "Node.js 20+ is required. Current version: $(node -v)"
    }
    Write-Host "Node.js $(node -v)" -ForegroundColor Green
} catch {
    Write-Host "Node.js is required. Please install Node.js 20+." -ForegroundColor Red
    exit 1
}

try {
    $dockerVersion = docker --version
    Write-Host "Docker installed" -ForegroundColor Green
} catch {
    Write-Host "Docker not found. You'll need to set up PostgreSQL manually." -ForegroundColor Yellow
}

Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..."
npm install

Write-Host ""

# Copy environment file
$envFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env file from template..."
    Copy-Item (Join-Path $ProjectRoot "config\environments\local.env.template") $envFile
    Write-Host "Created .env file" -ForegroundColor Green
    Write-Host ""
    Write-Host "Please edit .env and configure your environment variables." -ForegroundColor Yellow
    Write-Host "At minimum, you need to:"
    Write-Host "  1. Generate JWT keys (use OpenSSL or online generator)"
    Write-Host "  2. Update DATABASE_URL if not using Docker"
    Write-Host ""
} else {
    Write-Host ".env file already exists" -ForegroundColor Green
}

# Generate development certificates
$certFile = Join-Path $ProjectRoot "certs\dev\localhost.crt"
if (-not (Test-Path $certFile)) {
    Write-Host "Generating development TLS certificates..."
    & (Join-Path $ScriptDir "generate-dev-certs.ps1")
} else {
    Write-Host "Development certificates already exist" -ForegroundColor Green
}

Write-Host ""

# Start Docker services
try {
    Write-Host "Starting Docker services..."
    docker-compose -f (Join-Path $ProjectRoot "infra\docker\docker-compose.dev.yml") up -d

    Write-Host "Waiting for PostgreSQL to be ready..."
    Start-Sleep -Seconds 5

    # Check if PostgreSQL is ready
    $maxAttempts = 30
    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            docker exec jubilee-sso-postgres pg_isready -U jubilee_sso -d jubilee_sso_dev 2>&1 | Out-Null
            Write-Host "PostgreSQL is ready" -ForegroundColor Green
            break
        } catch {
            if ($i -eq $maxAttempts) {
                throw "PostgreSQL failed to start"
            }
            Start-Sleep -Seconds 1
        }
    }
} catch {
    Write-Host "Docker services could not be started: $_" -ForegroundColor Yellow
    Write-Host "Please ensure Docker is running and try again." -ForegroundColor Yellow
}

Write-Host ""

# Run migrations
Write-Host "Running database migrations..."
Set-Location (Join-Path $ProjectRoot "services\jubilee-sso")
npm run migrate

Write-Host ""

# Seed development data
Write-Host "Seeding development data..."
npm run seed:dev

Write-Host ""

Write-Host "=============================================="
Write-Host "  Setup Complete!"
Write-Host "=============================================="
Write-Host ""
Write-Host "To start the SSO service:"
Write-Host "  cd services\jubilee-sso; npm run dev"
Write-Host ""
Write-Host "The service will be available at:"
Write-Host "  https://localhost:3000"
Write-Host ""
Write-Host "Test endpoints:"
Write-Host "  https://localhost:3000/health"
Write-Host "  https://localhost:3000/.well-known/openid-configuration"
Write-Host ""
Write-Host "See docs\onboarding.md for more information."
Write-Host ""
