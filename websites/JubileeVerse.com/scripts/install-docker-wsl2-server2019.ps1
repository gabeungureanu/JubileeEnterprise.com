# Docker Installation for Windows Server 2019 via WSL2
# This script installs WSL2, Ubuntu, and Docker in the WSL environment
# Run as Administrator

param(
    [switch]$SkipRestart
)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Docker Installation for Windows Server 2019 via WSL2" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Running as Administrator" -ForegroundColor Green
Write-Host ""

# Get Windows version
$osInfo = Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion
Write-Host "OS: $($osInfo.WindowsProductName)" -ForegroundColor Cyan
Write-Host "Version: $($osInfo.WindowsVersion)" -ForegroundColor Cyan
Write-Host ""

# Step 1: Enable WSL Feature
Write-Host "[Step 1/6] Enabling WSL feature..." -ForegroundColor Yellow
$wslFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux

if ($wslFeature.State -eq "Enabled") {
    Write-Host "✓ WSL feature already enabled" -ForegroundColor Green
} else {
    Write-Host "Enabling WSL feature (this may take a few minutes)..." -ForegroundColor Cyan
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
    Write-Host "✓ WSL feature enabled" -ForegroundColor Green
    $needRestart = $true
}
Write-Host ""

# Step 2: Enable Virtual Machine Platform
Write-Host "[Step 2/6] Enabling Virtual Machine Platform..." -ForegroundColor Yellow
$vmFeature = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform

if ($vmFeature.State -eq "Enabled") {
    Write-Host "✓ Virtual Machine Platform already enabled" -ForegroundColor Green
} else {
    Write-Host "Enabling Virtual Machine Platform..." -ForegroundColor Cyan
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
    Write-Host "✓ Virtual Machine Platform enabled" -ForegroundColor Green
    $needRestart = $true
}
Write-Host ""

# Step 3: Download and Install WSL2 Kernel Update
Write-Host "[Step 3/6] Installing WSL2 Linux Kernel Update..." -ForegroundColor Yellow
$wslUpdatePath = "$env:TEMP\wsl_update_x64.msi"

if (Test-Path "C:\Windows\System32\lxss\tools\kernel") {
    Write-Host "✓ WSL2 kernel already installed" -ForegroundColor Green
} else {
    Write-Host "Downloading WSL2 kernel update..." -ForegroundColor Cyan
    $wslUpdateUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"

    try {
        Invoke-WebRequest -Uri $wslUpdateUrl -OutFile $wslUpdatePath -UseBasicParsing
        Write-Host "Installing WSL2 kernel..." -ForegroundColor Cyan
        Start-Process msiexec.exe -Wait -ArgumentList "/i `"$wslUpdatePath`" /quiet /norestart"
        Remove-Item $wslUpdatePath -ErrorAction SilentlyContinue
        Write-Host "✓ WSL2 kernel installed" -ForegroundColor Green
    } catch {
        Write-Host "⚠ WSL2 kernel download/install failed - will retry after restart" -ForegroundColor Yellow
    }
}
Write-Host ""

# Check if restart is needed
if ($needRestart -and -not $SkipRestart) {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "  RESTART REQUIRED" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The system needs to restart to complete WSL installation." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After restart, run this script again to continue:" -ForegroundColor Cyan
    Write-Host "  .\scripts\install-docker-wsl2-server2019.ps1" -ForegroundColor White
    Write-Host ""

    $response = Read-Host "Restart now? (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host "Restarting in 10 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        Restart-Computer -Force
    } else {
        Write-Host ""
        Write-Host "Please restart manually and run this script again." -ForegroundColor Yellow
        exit 0
    }
}

# Step 4: Set WSL2 as default
Write-Host "[Step 4/6] Setting WSL2 as default version..." -ForegroundColor Yellow
try {
    wsl --set-default-version 2 2>&1 | Out-Null
    Write-Host "✓ WSL2 set as default" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not set WSL2 as default (will retry after Linux install)" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Install Ubuntu
Write-Host "[Step 5/6] Installing Ubuntu Linux distribution..." -ForegroundColor Yellow

# Check if Ubuntu is already installed
$ubuntuInstalled = wsl -l -q 2>&1 | Select-String -Pattern "Ubuntu"

if ($ubuntuInstalled) {
    Write-Host "✓ Ubuntu already installed" -ForegroundColor Green
} else {
    Write-Host "Downloading Ubuntu 22.04..." -ForegroundColor Cyan
    $ubuntuPath = "$env:TEMP\Ubuntu2204.appx"
    $ubuntuUrl = "https://aka.ms/wslubuntu2204"

    try {
        Invoke-WebRequest -Uri $ubuntuUrl -OutFile $ubuntuPath -UseBasicParsing
        Write-Host "Installing Ubuntu..." -ForegroundColor Cyan
        Add-AppxPackage -Path $ubuntuPath
        Remove-Item $ubuntuPath -ErrorAction SilentlyContinue
        Write-Host "✓ Ubuntu installed" -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANT: Ubuntu will now open for first-time setup" -ForegroundColor Yellow
        Write-Host "Please create a username and password when prompted" -ForegroundColor Yellow
        Write-Host ""
        Start-Sleep -Seconds 3

        # Launch Ubuntu for first-time setup
        Start-Process "ubuntu2204.exe"

        Write-Host "Waiting for Ubuntu setup to complete..." -ForegroundColor Cyan
        Write-Host "Press any key after you've created your user account in Ubuntu..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    } catch {
        Write-Host "✗ Ubuntu installation failed" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Manual installation steps:" -ForegroundColor Yellow
        Write-Host "1. Open Microsoft Store" -ForegroundColor White
        Write-Host "2. Search for 'Ubuntu 22.04'" -ForegroundColor White
        Write-Host "3. Click Install" -ForegroundColor White
        Write-Host "4. Launch Ubuntu and create a user account" -ForegroundColor White
        Write-Host "5. Run this script again" -ForegroundColor White
        exit 1
    }
}
Write-Host ""

# Step 6: Install Docker in WSL
Write-Host "[Step 6/6] Installing Docker in Ubuntu WSL..." -ForegroundColor Yellow
Write-Host "This will install Docker Engine inside the Ubuntu environment..." -ForegroundColor Cyan
Write-Host ""

# Create Docker installation script
$dockerInstallScript = @'
#!/bin/bash
set -e

echo "Updating package index..."
sudo apt-get update -qq

echo "Installing prerequisites..."
sudo apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

echo "Adding Docker's official GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "Setting up Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "Installing Docker Engine..."
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "Starting Docker service..."
sudo service docker start

echo "Adding current user to docker group..."
sudo usermod -aG docker $USER

echo ""
echo "Docker installation complete!"
docker --version
docker compose version
'@

# Save script to temp file
$dockerScriptPath = "/tmp/install-docker.sh"
$dockerInstallScript | wsl bash -c "cat > $dockerScriptPath && chmod +x $dockerScriptPath"

# Run installation
Write-Host "Running Docker installation in WSL (this may take 5-10 minutes)..." -ForegroundColor Cyan
wsl bash -c "/tmp/install-docker.sh"

Write-Host "✓ Docker installed in WSL" -ForegroundColor Green
Write-Host ""

# Verify installation
Write-Host "Verifying Docker installation..." -ForegroundColor Cyan
wsl bash -c "docker --version"
wsl bash -c "docker compose version"
Write-Host ""

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ✓ Installation Complete!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Docker is now running in WSL2 Ubuntu!" -ForegroundColor Green
Write-Host ""
Write-Host "Important Notes:" -ForegroundColor Cyan
Write-Host "  • Docker runs inside the WSL2 Ubuntu environment" -ForegroundColor White
Write-Host "  • You can access it from Windows PowerShell using 'wsl'" -ForegroundColor White
Write-Host "  • Your Windows files are accessible at /mnt/c/ in WSL" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Run: .\scripts\setup-wsl-docker-containers.ps1" -ForegroundColor White
Write-Host "  2. This will start PostgreSQL, Qdrant, and Redis" -ForegroundColor White
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "  wsl docker ps                  - View running containers" -ForegroundColor White
Write-Host "  wsl docker-compose --version   - Check docker-compose" -ForegroundColor White
Write-Host "  wsl                            - Enter WSL Ubuntu shell" -ForegroundColor White
Write-Host ""
