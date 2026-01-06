# Install PostgreSQL, Redis, and Qdrant directly on Windows Server 2019

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Installing Database Services for JubileeVerse" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install PostgreSQL
Write-Host "[1/5] Installing PostgreSQL 16..." -ForegroundColor Yellow

if (Test-Path "C:\Program Files\PostgreSQL\16\bin\postgres.exe") {
    Write-Host "✓ PostgreSQL already installed" -ForegroundColor Green
} else {
    Write-Host "Running PostgreSQL installer..." -ForegroundColor Cyan
    Start-Process "C:\Temp\postgresql-installer.exe" -ArgumentList @(
        "--mode", "unattended",
        "--superpassword", "askShaddai4e!",
        "--serverport", "5432",
        "--datadir", "C:\PostgreSQL\16\data",
        "--servicename", "postgresql-x64-16"
    ) -Wait -NoNewWindow
    Write-Host "✓ PostgreSQL installed" -ForegroundColor Green
}
Write-Host ""

# Step 2: Install Redis
Write-Host "[2/5] Installing Redis..." -ForegroundColor Yellow

if (Test-Path "C:\Program Files\Redis\redis-server.exe") {
    Write-Host "✓ Redis already installed" -ForegroundColor Green
} else {
    Write-Host "Running Redis installer..." -ForegroundColor Cyan
    Start-Process "msiexec.exe" -ArgumentList "/i C:\Temp\Redis-installer.msi /quiet /norestart" -Wait -NoNewWindow
    Write-Host "✓ Redis installed" -ForegroundColor Green
}
Write-Host ""

# Step 3: Extract and setup Qdrant
Write-Host "[3/5] Setting up Qdrant..." -ForegroundColor Yellow

if (Test-Path "C:\Program Files\Qdrant\qdrant.exe") {
    Write-Host "✓ Qdrant already set up" -ForegroundColor Green
} else {
    Write-Host "Extracting Qdrant..." -ForegroundColor Cyan
    Expand-Archive -Path "C:\Temp\qdrant.zip" -DestinationPath "C:\Program Files\Qdrant" -Force
    Write-Host "✓ Qdrant extracted" -ForegroundColor Green
}
Write-Host ""

# Step 4: Create JubileeVerse database
Write-Host "[4/5] Creating JubileeVerse database..." -ForegroundColor Yellow

$env:PGPASSWORD = "askShaddai4e!"
$createDbCommand = "C:\Program Files\PostgreSQL\16\bin\psql.exe -U postgres -c `"CREATE DATABASE JubileeVerse;`""

try {
    Invoke-Expression $createDbCommand 2>&1 | Out-Null
    Write-Host "✓ Database created" -ForegroundColor Green
} catch {
    Write-Host "⚠ Database may already exist or PostgreSQL not ready" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Verify services
Write-Host "[5/5] Verifying services..." -ForegroundColor Yellow

# Check PostgreSQL service
$pgService = Get-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "✓ PostgreSQL service running" -ForegroundColor Green
} else {
    Write-Host "⚠ PostgreSQL service not running" -ForegroundColor Yellow
}

# Check Redis service
$redisService = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
if ($redisService -and $redisService.Status -eq "Running") {
    Write-Host "✓ Redis service running" -ForegroundColor Green
} else {
    Write-Host "⚠ Redis service not running, starting..." -ForegroundColor Yellow
    Start-Service Redis -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  PostgreSQL: localhost:5432 (Database: JubileeVerse)" -ForegroundColor White
Write-Host "  Redis:      localhost:6379" -ForegroundColor White
Write-Host "  Qdrant:     http://localhost:6333 (manual start required)" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start Qdrant: powershell -Command `"cd 'C:\Program Files\Qdrant'; .\qdrant.exe`"" -ForegroundColor White
Write-Host "  2. Install dependencies: npm install" -ForegroundColor White
Write-Host "  3. Run migrations: npm run db:setup" -ForegroundColor White
Write-Host "  4. Start application: npm start" -ForegroundColor White
Write-Host ""
