param([switch]$Elevated)

$ErrorActionPreference = "Continue"
$LogFile = "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\logs\fix-wwbibleweb.log"

# Ensure log directory exists
$logDir = Split-Path $LogFile -Parent
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

Log "=========================================="
Log "Fix wwBibleweb.com Service"
Log "=========================================="

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Log "Running as Administrator: $isAdmin"

if (-not $isAdmin) {
    Log "Requesting elevation..."
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Elevated" -Verb RunAs -Wait
    exit
}

# Step 1: Stop and remove the broken service
Log "Step 1: Stopping broken service..."
Stop-Service -Name "wwbibleweb.exe" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Log "Step 2: Removing broken service..."
$result = sc.exe delete "wwbibleweb.exe" 2>&1
Log "sc.exe delete result: $result"
Start-Sleep -Seconds 2

# Step 3: Check if daemon directory exists in correct location
$correctPath = "C:\data\JubileeEnterprise.com Bibleweb\websites\codex\wwBibleweb.com"
$daemonPath = "$correctPath\daemon"

Log "Step 3: Checking paths..."
Log "Correct path: $correctPath"
Log "Daemon path: $daemonPath"

if (!(Test-Path $daemonPath)) {
    Log "Creating daemon directory..."
    New-Item -ItemType Directory -Path $daemonPath -Force | Out-Null
}

# Step 4: Reinstall the service using node-windows or direct method
Log "Step 4: Reinstalling service..."

# Check if install-service.js exists
$installScript = "$correctPath\install-service.js"
if (Test-Path $installScript) {
    Log "Running install-service.js..."
    Push-Location $correctPath
    $output = node install-service.js 2>&1
    Log "Install output: $output"
    Pop-Location
} else {
    Log "install-service.js not found, creating service manually..."

    # Create a simple wrapper to start the server
    $wrapperScript = @"
const { Service } = require('node-windows');
const path = require('path');

const svc = new Service({
    name: 'wwBibleweb',
    description: 'wwBibleweb.com - Bible Web Portal',
    script: path.join(__dirname, 'server.js'),
    env: [{
        name: 'PORT',
        value: '3116'
    }]
});

svc.on('install', () => {
    console.log('Service installed, starting...');
    svc.start();
});

svc.on('alreadyinstalled', () => {
    console.log('Service already installed');
});

svc.on('error', (err) => {
    console.error('Service error:', err);
});

svc.install();
"@

    Set-Content -Path $installScript -Value $wrapperScript
    Log "Created install-service.js"

    Push-Location $correctPath
    $output = node install-service.js 2>&1
    Log "Install output: $output"
    Pop-Location
}

# Step 5: Wait and verify
Log "Step 5: Waiting for service to start..."
Start-Sleep -Seconds 5

$svc = Get-Service -Name "wwbibleweb*" -ErrorAction SilentlyContinue
if ($svc) {
    Log "Service found: $($svc.Name) - Status: $($svc.Status)"

    if ($svc.Status -ne "Running") {
        Log "Starting service..."
        Start-Service -Name $svc.Name
        Start-Sleep -Seconds 3
    }
} else {
    Log "Service not found after install"
}

# Step 6: Test the port
Log "Step 6: Testing port 3116..."
Start-Sleep -Seconds 3

$listener = Get-NetTCPConnection -LocalPort 3116 -ErrorAction SilentlyContinue
if ($listener) {
    Log "Port 3116 is listening!"

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3116/health" -TimeoutSec 5 -UseBasicParsing
        Log "Health check: OK ($($response.StatusCode))"
    } catch {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3116/" -TimeoutSec 5 -UseBasicParsing
            Log "Root check: OK ($($response.StatusCode))"
        } catch {
            Log "HTTP check failed: $($_.Exception.Message)"
        }
    }
} else {
    Log "Port 3116 NOT listening"
}

Log "=========================================="
Log "Done"
