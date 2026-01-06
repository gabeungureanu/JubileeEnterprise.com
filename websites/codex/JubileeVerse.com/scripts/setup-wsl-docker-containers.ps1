# Setup Docker Containers in WSL2 for JubileeVerse
# Run this AFTER install-docker-wsl2-server2019.ps1 completes

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  JubileeVerse WSL Docker Container Setup" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if WSL is available
Write-Host "[1/5] Checking WSL..." -ForegroundColor Yellow
try {
    wsl --status | Out-Null
    Write-Host "✓ WSL is available" -ForegroundColor Green
} catch {
    Write-Host "✗ WSL is not installed" -ForegroundColor Red
    Write-Host "Please run: .\scripts\install-docker-wsl2-server2019.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Check if Docker is running in WSL
Write-Host "[2/5] Checking Docker in WSL..." -ForegroundColor Yellow
$dockerCheck = wsl bash -c "docker --version 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker is installed in WSL" -ForegroundColor Green
    Write-Host "  $dockerCheck" -ForegroundColor Gray
} else {
    Write-Host "✗ Docker is not installed in WSL" -ForegroundColor Red
    Write-Host "Please run: .\scripts\install-docker-wsl2-server2019.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Start Docker service if not running
Write-Host "[3/5] Starting Docker service in WSL..." -ForegroundColor Yellow
wsl bash -c "sudo service docker status" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting Docker service..." -ForegroundColor Cyan
    wsl bash -c "sudo service docker start"
    Start-Sleep -Seconds 3
}
Write-Host "✓ Docker service is running" -ForegroundColor Green
Write-Host ""

# Create data directories in WSL
Write-Host "[4/5] Creating data directories..." -ForegroundColor Yellow
wsl bash -c "mkdir -p /mnt/c/Data/JubileeVerse/.datastore/postgres"
wsl bash -c "mkdir -p /mnt/c/Data/JubileeVerse/.datastore/qdrant"
wsl bash -c "mkdir -p /mnt/c/Data/JubileeVerse/.datastore/redis"
Write-Host "✓ Data directories created" -ForegroundColor Green
Write-Host ""

# Start containers using docker-compose
Write-Host "[5/5] Starting Docker containers..." -ForegroundColor Yellow
Write-Host "This will start PostgreSQL, Qdrant, and Redis..." -ForegroundColor Cyan
Write-Host ""

# Navigate to project directory in WSL and run docker-compose
$projectPath = "/mnt/c/Data/JubileeVerse.com"
$composeFile = "docker-compose.production.yml"

wsl bash -c "cd $projectPath && sudo docker compose -f $composeFile up -d"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Containers started successfully!" -ForegroundColor Green
    Write-Host ""

    # Wait for containers to be ready
    Write-Host "Waiting for containers to initialize..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10

    # Check container status
    Write-Host ""
    Write-Host "Container Status:" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
    wsl bash -c "cd $projectPath && sudo docker ps --filter 'name=JubileeVerse' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
    Write-Host ""

    # Test connections
    Write-Host "Testing Connections:" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

    # Test PostgreSQL
    Write-Host "PostgreSQL: " -NoNewline
    $pgTest = wsl bash -c "cd $projectPath && sudo docker exec JubileeVerse-postgres psql -U guardian -d JubileeVerse -c 'SELECT version();' 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Connected" -ForegroundColor Green
    } else {
        Write-Host "⚠ Pending" -ForegroundColor Yellow
    }

    # Test Qdrant
    Write-Host "Qdrant:     " -NoNewline
    $qdrantTest = wsl bash -c "curl -s http://localhost:6333/health 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Connected" -ForegroundColor Green
    } else {
        Write-Host "⚠ Pending" -ForegroundColor Yellow
    }

    # Test Redis
    Write-Host "Redis:      " -NoNewline
    $redisTest = wsl bash -c "cd $projectPath && sudo docker exec JubileeVerse-redis redis-cli ping 2>&1"
    if ($redisTest -match "PONG") {
        Write-Host "✓ Connected" -ForegroundColor Green
    } else {
        Write-Host "⚠ Pending" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "  ✓ Setup Complete!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Container Details:" -ForegroundColor Cyan
    Write-Host "  PostgreSQL:" -ForegroundColor White
    Write-Host "    - Container: JubileeVerse-postgres" -ForegroundColor Gray
    Write-Host "    - Database: JubileeVerse" -ForegroundColor Gray
    Write-Host "    - Port: 5432" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Qdrant:" -ForegroundColor White
    Write-Host "    - Container: JubileeVerse-qdrant" -ForegroundColor Gray
    Write-Host "    - HTTP: http://localhost:6333" -ForegroundColor Gray
    Write-Host "    - Dashboard: http://localhost:6333/dashboard" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Redis:" -ForegroundColor White
    Write-Host "    - Container: JubileeVerse-redis" -ForegroundColor Gray
    Write-Host "    - Port: 6379" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Install dependencies:  npm install" -ForegroundColor White
    Write-Host "  2. Run migrations:        npm run db:setup" -ForegroundColor White
    Write-Host "  3. Start application:     npm start" -ForegroundColor White
    Write-Host ""
    Write-Host "Useful WSL Docker Commands:" -ForegroundColor Cyan
    Write-Host "  wsl bash -c 'cd $projectPath && sudo docker ps'" -ForegroundColor Gray
    Write-Host "  wsl bash -c 'cd $projectPath && sudo docker compose -f $composeFile logs -f'" -ForegroundColor Gray
    Write-Host "  wsl bash -c 'cd $projectPath && sudo docker compose -f $composeFile restart'" -ForegroundColor Gray
    Write-Host "  wsl bash -c 'cd $projectPath && sudo docker compose -f $composeFile down'" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✗ Failed to start containers" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Cyan
    Write-Host "  1. Ensure Docker service is running: wsl bash -c 'sudo service docker start'" -ForegroundColor White
    Write-Host "  2. Check Docker status: wsl bash -c 'sudo docker ps'" -ForegroundColor White
    Write-Host "  3. View logs: wsl bash -c 'cd $projectPath && sudo docker compose -f $composeFile logs'" -ForegroundColor White
    Write-Host ""
    exit 1
}
