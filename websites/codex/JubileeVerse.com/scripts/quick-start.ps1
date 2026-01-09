# Quick Start Script for JubileeVerse Production
# This script checks prerequisites and starts everything in the correct order

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  JubileeVerse Quick Start" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
Set-Location $projectDir

Write-Host "Project: $projectDir" -ForegroundColor White
Write-Host ""

# Step 1: Check Docker
Write-Host "[1/6] Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "      Docker is running" -ForegroundColor Green
} catch {
    Write-Host "      ERROR: Docker is not running" -ForegroundColor Red
    Write-Host "      Please start Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}

# Step 2: Check if containers exist
Write-Host "[2/6] Checking containers..." -ForegroundColor Yellow
$containersExist = docker ps -a --filter "name=JubileeVerse-postgres" --format "{{.Names}}"

if ($containersExist) {
    Write-Host "      Containers found" -ForegroundColor Green

    # Check if containers are running
    $containersRunning = docker ps --filter "name=JubileeVerse-postgres" --format "{{.Names}}"

    if ($containersRunning) {
        Write-Host "      Containers are already running" -ForegroundColor Green
    } else {
        Write-Host "      Starting existing containers..." -ForegroundColor Cyan
        docker-compose -f docker-compose.production.yml start
        Start-Sleep -Seconds 5
    }
} else {
    Write-Host "      No containers found, creating new containers..." -ForegroundColor Cyan

    # Create data directories
    New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse.com\.datastore\postgres" | Out-Null
    New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse.com\.datastore\qdrant" | Out-Null
    New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse.com\.datastore\redis" | Out-Null

    docker-compose -f docker-compose.production.yml up -d
    Start-Sleep -Seconds 10
}

# Step 3: Check Node.js
Write-Host "[3/6] Checking Node.js..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "      Node.js version: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "      ERROR: Node.js not found" -ForegroundColor Red
    Write-Host "      Please install Node.js 18+ and try again" -ForegroundColor Yellow
    exit 1
}

# Step 4: Check dependencies
Write-Host "[4/6] Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "      Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "      Installing dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "      Dependencies installed successfully" -ForegroundColor Green
}

# Step 5: Check database
Write-Host "[5/6] Checking database..." -ForegroundColor Yellow
$dbCheck = docker exec JubileeVerse-postgres psql -U guardian -d JubileeVerse -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "      Database is ready" -ForegroundColor Green

    # Check if migrations are needed
    if ($dbCheck -match "0 rows" -or $dbCheck -match "^\s*0\s*$") {
        Write-Host "      Running database migrations..." -ForegroundColor Cyan
        npm run db:setup
    }
} else {
    Write-Host "      Database not ready, waiting..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    Write-Host "      Running database setup..." -ForegroundColor Cyan
    npm run db:setup
}

# Step 6: Container health summary
Write-Host "[6/6] Container Health Summary" -ForegroundColor Yellow
Write-Host ""
docker ps --filter "name=JubileeVerse" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""

# Display URLs
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Ready to Start!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  PostgreSQL  : localhost:5432 (Database: JubileeVerse)" -ForegroundColor White
Write-Host "  Qdrant      : http://localhost:6333/dashboard" -ForegroundColor White
Write-Host "  Redis       : localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "Start the application:" -ForegroundColor Cyan
Write-Host "  npm start        - Production mode" -ForegroundColor White
Write-Host "  npm run dev      - Development mode (auto-reload)" -ForegroundColor White
Write-Host ""
Write-Host "After starting, visit:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000" -ForegroundColor White
Write-Host ""
