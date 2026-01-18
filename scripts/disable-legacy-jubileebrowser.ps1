# Disable Legacy JubileeBrowser Windows Service
# This service conflicts with InspireContinuum on port 3200
# Run as Administrator

$ErrorActionPreference = "Continue"

Write-Host "=== Disable Legacy JubileeBrowser Service ===" -ForegroundColor Yellow
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting elevation..." -ForegroundColor Cyan
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

# Step 1: Stop the service
Write-Host "Step 1: Stopping jubileebrowser.exe service..." -ForegroundColor Cyan
$svc = Get-Service -Name "jubileebrowser.exe" -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.Status -eq "Running") {
        Stop-Service -Name "jubileebrowser.exe" -Force
        Start-Sleep -Seconds 3
        Write-Host "  Service stopped" -ForegroundColor Green
    } else {
        Write-Host "  Service already stopped" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Service not found" -ForegroundColor Gray
}

# Step 2: Disable the service
Write-Host ""
Write-Host "Step 2: Disabling jubileebrowser.exe service..." -ForegroundColor Cyan
Set-Service -Name "jubileebrowser.exe" -StartupType Disabled -ErrorAction SilentlyContinue
Write-Host "  Service disabled (will not start on boot)" -ForegroundColor Green

# Step 3: Verify port 3200 is free
Write-Host ""
Write-Host "Step 3: Verifying port 3200 is free..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
$netstat = netstat -ano | Select-String ":3200.*LISTENING"
if ($netstat) {
    $pid3200 = ($netstat -split '\s+')[-1]
    Write-Host "  Port 3200 still in use by PID: $pid3200" -ForegroundColor Yellow
} else {
    Write-Host "  Port 3200 is now free!" -ForegroundColor Green
}

# Step 4: Trigger API services reload
Write-Host ""
Write-Host "Step 4: Triggering API services reload..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3901/reload" -TimeoutSec 5
    Write-Host "  Reload triggered: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "  Failed to trigger reload: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 10

# Step 5: Verify InspireContinuum is running
Write-Host ""
Write-Host "Step 5: Verifying InspireContinuum..." -ForegroundColor Cyan

# Check port 3200
$netstat2 = netstat -ano | Select-String ":3200.*LISTENING"
if ($netstat2) {
    $newPid = ($netstat2 -split '\s+')[-1]
    Write-Host "  Port 3200 now owned by PID: $newPid" -ForegroundColor Green
} else {
    Write-Host "  Port 3200 still not bound!" -ForegroundColor Red
}

# Check health endpoint
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3901/health" -TimeoutSec 5
    $continuum = $health.services | Where-Object { $_.name -eq "inspirecontinuum-api" }
    if ($continuum) {
        Write-Host "  InspireContinuum status: $($continuum.status)" -ForegroundColor $(if ($continuum.status -eq "running") { "Green" } else { "Red" })
        Write-Host "  InspireContinuum PID: $($continuum.pid)" -ForegroundColor Gray
        Write-Host "  InspireContinuum restarts: $($continuum.restarts)" -ForegroundColor Gray
    } else {
        Write-Host "  InspireContinuum not in service list yet (may need more time)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Failed to check health: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "The legacy JubileeBrowser service has been stopped and disabled." -ForegroundColor Gray
Write-Host "JubileeBrowser now runs under the Inspire 8.0 unified service manager on port 3103." -ForegroundColor Gray
Write-Host ""
Write-Host "Press Enter to close." -ForegroundColor Gray
Read-Host
