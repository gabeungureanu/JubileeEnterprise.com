param([switch]$Elevated)

$ErrorActionPreference = "Continue"
$LogFile = "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\logs\reinstall-wwbibleweb.log"

$logDir = Split-Path $LogFile -Parent
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

Log "=========================================="
Log "Reinstall wwBibleweb.com Service (Port 3116)"
Log "=========================================="

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Log "Running as Administrator: $isAdmin"

if (-not $isAdmin) {
    Log "Requesting elevation..."
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Elevated" -Verb RunAs -Wait
    exit
}

$sitePath = "C:\data\JubileeEnterprise.com Bibleweb\websites\codex\wwBibleweb.com"

# Step 1: Stop and remove existing service
Log "Step 1: Stopping existing service..."
Stop-Service -Name "wwbibleweb.exe" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Log "Step 2: Removing existing service..."
$result = sc.exe delete "wwbibleweb.exe" 2>&1
Log "Result: $result"
Start-Sleep -Seconds 2

# Step 3: Run uninstall script if exists
$uninstallScript = "$sitePath\uninstall-service.js"
if (Test-Path $uninstallScript) {
    Log "Step 3: Running uninstall-service.js..."
    Push-Location $sitePath
    node uninstall-service.js 2>&1 | ForEach-Object { Log $_ }
    Pop-Location
    Start-Sleep -Seconds 2
}

# Step 4: Reinstall with correct port
Log "Step 4: Installing service with PORT=3116..."
Push-Location $sitePath
$output = node install-service.js 2>&1
Log "Install output: $output"
Pop-Location

# Step 5: Wait for service
Log "Step 5: Waiting for service to start..."
Start-Sleep -Seconds 8

# Step 6: Check service status
$svc = Get-Service -Name "wwbibleweb.exe" -ErrorAction SilentlyContinue
if ($svc) {
    Log "Service Status: $($svc.Status)"
    if ($svc.Status -ne "Running") {
        Log "Starting service..."
        Start-Service -Name "wwbibleweb.exe"
        Start-Sleep -Seconds 5
    }
} else {
    Log "ERROR: Service not found!"
}

# Step 7: Test port
Log "Step 7: Testing port 3116..."
Start-Sleep -Seconds 3

$maxRetries = 10
$retryCount = 0
$success = $false

while ($retryCount -lt $maxRetries -and -not $success) {
    $listener = Get-NetTCPConnection -LocalPort 3116 -ErrorAction SilentlyContinue
    if ($listener) {
        Log "Port 3116 is listening!"
        $success = $true

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3116/health" -TimeoutSec 5 -UseBasicParsing
            Log "Health check: OK ($($response.StatusCode))"
        } catch {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:3116/" -TimeoutSec 5 -UseBasicParsing
                Log "Root check: OK ($($response.StatusCode))"
            } catch {
                Log "HTTP check failed but port is open"
            }
        }
    } else {
        $retryCount++
        Log "Port not ready, retry $retryCount/$maxRetries..."
        Start-Sleep -Seconds 2
    }
}

if (-not $success) {
    Log "ERROR: Port 3116 never became available"
}

Log "=========================================="
Log "Done"
