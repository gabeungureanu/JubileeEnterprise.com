# Docker Installation Script for Windows Server
# Run this script as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Docker Installation for JubileeVerse" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Running as Administrator - OK" -ForegroundColor Green
Write-Host ""

# Check Windows version
$osInfo = Get-WmiObject -Class Win32_OperatingSystem
Write-Host "OS: $($osInfo.Caption)" -ForegroundColor Cyan
Write-Host "Version: $($osInfo.Version)" -ForegroundColor Cyan
Write-Host ""

# Install Chocolatey if not present
Write-Host "Checking for Chocolatey package manager..." -ForegroundColor Cyan
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Host "Chocolatey installed successfully" -ForegroundColor Green
} else {
    Write-Host "Chocolatey already installed" -ForegroundColor Green
}
Write-Host ""

# Install Docker Desktop
Write-Host "Checking for Docker..." -ForegroundColor Cyan
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Docker Desktop..." -ForegroundColor Yellow
    Write-Host "Note: This may take several minutes and require a system restart" -ForegroundColor Yellow

    choco install docker-desktop -y

    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Host ""
    Write-Host "Docker Desktop installed" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: You may need to:" -ForegroundColor Yellow
    Write-Host "1. Restart your computer" -ForegroundColor Yellow
    Write-Host "2. Start Docker Desktop from the Start Menu" -ForegroundColor Yellow
    Write-Host "3. Enable WSL2 if prompted" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "Docker already installed" -ForegroundColor Green
    docker --version
}
Write-Host ""

# Check if Docker is running
Write-Host "Checking if Docker daemon is running..." -ForegroundColor Cyan
$dockerRunning = $false
try {
    docker ps | Out-Null
    $dockerRunning = $true
    Write-Host "Docker daemon is running" -ForegroundColor Green
} catch {
    Write-Host "Docker daemon is NOT running" -ForegroundColor Yellow
    Write-Host "Please start Docker Desktop and wait for it to be ready" -ForegroundColor Yellow
}
Write-Host ""

# Install Docker Compose (if not included with Docker Desktop)
Write-Host "Checking for Docker Compose..." -ForegroundColor Cyan
if (!(Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "Docker Compose not found - it should be included with Docker Desktop" -ForegroundColor Yellow
    Write-Host "Please ensure Docker Desktop is fully installed and running" -ForegroundColor Yellow
} else {
    Write-Host "Docker Compose installed" -ForegroundColor Green
    docker-compose --version
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Chocolatey: " -NoNewline
if (Get-Command choco -ErrorAction SilentlyContinue) { Write-Host "Installed" -ForegroundColor Green } else { Write-Host "Not Installed" -ForegroundColor Red }

Write-Host "Docker: " -NoNewline
if (Get-Command docker -ErrorAction SilentlyContinue) { Write-Host "Installed" -ForegroundColor Green } else { Write-Host "Not Installed" -ForegroundColor Red }

Write-Host "Docker Compose: " -NoNewline
if (Get-Command docker-compose -ErrorAction SilentlyContinue) { Write-Host "Installed" -ForegroundColor Green } else { Write-Host "Not Installed" -ForegroundColor Red }

Write-Host "Docker Running: " -NoNewline
if ($dockerRunning) { Write-Host "Yes" -ForegroundColor Green } else { Write-Host "No" -ForegroundColor Red }

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. If Docker is not running, start Docker Desktop" -ForegroundColor White
Write-Host "2. Run: docker ps   (to verify Docker is working)" -ForegroundColor White
Write-Host "3. Navigate to your project directory" -ForegroundColor White
Write-Host "4. Run: docker-compose -f docker-compose.production.yml up -d" -ForegroundColor White
Write-Host ""
