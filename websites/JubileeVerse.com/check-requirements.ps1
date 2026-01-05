# Check Requirements Script
# Verifies if Node.js and Docker are installed and ready

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JubileeVerse Requirements Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server: solarwinding (10.0.0.4)" -ForegroundColor White
Write-Host ""

$allGood = $true

# Check Node.js
Write-Host "[1/2] Checking Node.js..." -ForegroundColor Cyan
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "      ✓ Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "      ✓ npm: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "      ✗ Node.js NOT FOUND" -ForegroundColor Red
    Write-Host "      Install from: https://nodejs.org/" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# Check Docker
Write-Host "[2/2] Checking Docker..." -ForegroundColor Cyan
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerVersion = docker --version
    Write-Host "      ✓ Docker: $dockerVersion" -ForegroundColor Green

    # Check if Docker daemon is running
    try {
        docker ps | Out-Null
        Write-Host "      ✓ Docker daemon is running" -ForegroundColor Green
    } catch {
        Write-Host "      ✗ Docker daemon is NOT running" -ForegroundColor Red
        Write-Host "      Please start Docker Desktop" -ForegroundColor Yellow
        $allGood = $false
    }
} else {
    Write-Host "      ✗ Docker NOT FOUND" -ForegroundColor Red
    Write-Host "      Install from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✓ All Requirements Met!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ready to start! Run:" -ForegroundColor Cyan
    Write-Host "  .\scripts\quick-start.ps1" -ForegroundColor Green
    Write-Host ""
    Write-Host "Or manually:" -ForegroundColor Cyan
    Write-Host "  docker-compose -f docker-compose.production.yml up -d" -ForegroundColor White
    Write-Host "  npm install" -ForegroundColor White
    Write-Host "  npm run db:setup" -ForegroundColor White
    Write-Host "  npm start" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✗ Missing Requirements" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please install missing software:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Node.js LTS: https://nodejs.org/" -ForegroundColor White
    Write-Host "  2. Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host ""
    Write-Host "After installation:" -ForegroundColor Yellow
    Write-Host "  - Restart this PowerShell window" -ForegroundColor White
    Write-Host "  - Run this script again to verify" -ForegroundColor White
    Write-Host "  - See INSTALL_REQUIREMENTS.md for detailed instructions" -ForegroundColor White
    Write-Host ""
}
