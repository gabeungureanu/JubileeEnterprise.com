# Production Container Setup Script for JubileeVerse
# Server: solarwinding (10.0.0.4)
# Run this script to set up Docker containers for production

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "JubileeVerse Production Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
Set-Location $projectDir

Write-Host "Project Directory: $projectDir" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -ForegroundColor Cyan
try {
    docker ps | Out-Null
    Write-Host "Docker is running - OK" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Create data directories if they don't exist
Write-Host "Creating data storage directories..." -ForegroundColor Cyan
$dataDir = "C:\Data\JubileeVerse\.datastore"
$postgresDIr = "$dataDir\postgres"
$qdrantDir = "$dataDir\qdrant"
$redisDir = "$dataDir\redis"

New-Item -ItemType Directory -Force -Path $postgresDIr | Out-Null
New-Item -ItemType Directory -Force -Path $qdrantDir | Out-Null
New-Item -ItemType Directory -Force -Path $redisDir | Out-Null

Write-Host "Created: $postgresDIr" -ForegroundColor Green
Write-Host "Created: $qdrantDir" -ForegroundColor Green
Write-Host "Created: $redisDir" -ForegroundColor Green
Write-Host ""

# Stop any existing containers
Write-Host "Stopping existing JubileeVerse containers (if any)..." -ForegroundColor Cyan
docker stop JubileeVerse-postgres JubileeVerse-qdrant JubileeVerse-redis 2>$null
docker rm JubileeVerse-postgres JubileeVerse-qdrant JubileeVerse-redis 2>$null
Write-Host "Cleanup complete" -ForegroundColor Green
Write-Host ""

# Start containers using docker-compose
Write-Host "Starting production containers..." -ForegroundColor Cyan
Write-Host ""
docker-compose -f docker-compose.production.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Containers started successfully!" -ForegroundColor Green
    Write-Host ""

    # Wait for health checks
    Write-Host "Waiting for containers to be healthy..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10

    # Check container status
    Write-Host ""
    Write-Host "Container Status:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    docker ps --filter "name=JubileeVerse" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    Write-Host ""

    # Test PostgreSQL connection
    Write-Host "Testing PostgreSQL connection..." -ForegroundColor Cyan
    $pgTest = docker exec JubileeVerse-postgres psql -U guardian -d JubileeVerse -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL: Connected" -ForegroundColor Green
        Write-Host "Database: JubileeVerse" -ForegroundColor Green
    } else {
        Write-Host "PostgreSQL: Connection failed" -ForegroundColor Yellow
    }
    Write-Host ""

    # Test Qdrant connection
    Write-Host "Testing Qdrant connection..." -ForegroundColor Cyan
    try {
        $qdrantTest = Invoke-WebRequest -Uri "http://localhost:6333/health" -UseBasicParsing -TimeoutSec 5
        if ($qdrantTest.StatusCode -eq 200) {
            Write-Host "Qdrant: Connected" -ForegroundColor Green
            Write-Host "HTTP API: http://localhost:6333" -ForegroundColor Green
        }
    } catch {
        Write-Host "Qdrant: Connection pending (may still be starting)" -ForegroundColor Yellow
    }
    Write-Host ""

    # Test Redis connection
    Write-Host "Testing Redis connection..." -ForegroundColor Cyan
    $redisTest = docker exec JubileeVerse-redis redis-cli ping 2>&1
    if ($redisTest -eq "PONG") {
        Write-Host "Redis: Connected" -ForegroundColor Green
    } else {
        Write-Host "Redis: Connection failed" -ForegroundColor Yellow
    }
    Write-Host ""

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Setup Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Container Details:" -ForegroundColor Cyan
    Write-Host "  PostgreSQL:" -ForegroundColor White
    Write-Host "    - Container: JubileeVerse-postgres" -ForegroundColor White
    Write-Host "    - Database: JubileeVerse" -ForegroundColor White
    Write-Host "    - Port: 5432" -ForegroundColor White
    Write-Host "    - User: guardian" -ForegroundColor White
    Write-Host ""
    Write-Host "  Qdrant:" -ForegroundColor White
    Write-Host "    - Container: JubileeVerse-qdrant" -ForegroundColor White
    Write-Host "    - HTTP API: http://localhost:6333" -ForegroundColor White
    Write-Host "    - gRPC API: http://localhost:6334" -ForegroundColor White
    Write-Host "    - Dashboard: http://localhost:6333/dashboard" -ForegroundColor White
    Write-Host ""
    Write-Host "  Redis:" -ForegroundColor White
    Write-Host "    - Container: JubileeVerse-redis" -ForegroundColor White
    Write-Host "    - Port: 6379" -ForegroundColor White
    Write-Host ""
    Write-Host "Data Storage:" -ForegroundColor Cyan
    Write-Host "  $dataDir" -ForegroundColor White
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Run database migrations: npm run db:setup" -ForegroundColor White
    Write-Host "  2. Start the application: npm start" -ForegroundColor White
    Write-Host ""
    Write-Host "Useful Commands:" -ForegroundColor Cyan
    Write-Host "  View logs: docker-compose -f docker-compose.production.yml logs -f" -ForegroundColor White
    Write-Host "  Stop containers: docker-compose -f docker-compose.production.yml down" -ForegroundColor White
    Write-Host "  Restart containers: docker-compose -f docker-compose.production.yml restart" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERROR: Failed to start containers" -ForegroundColor Red
    Write-Host "Check the error messages above for details" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
