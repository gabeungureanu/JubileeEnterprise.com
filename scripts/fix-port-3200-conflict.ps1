# Fix Port 3200 Conflict
# Kills orphaned process on port 3200 and restarts API services
# Run as Administrator

param(
    [switch]$Force
)

$ErrorActionPreference = "Continue"

Write-Host "=== Fix Port 3200 Conflict ===" -ForegroundColor Yellow
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting elevation..." -ForegroundColor Cyan
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

# Step 1: Find process on port 3200
Write-Host "Step 1: Finding process on port 3200..." -ForegroundColor Cyan
$netstat = netstat -ano | Select-String ":3200.*LISTENING"
if ($netstat) {
    $pid3200 = ($netstat -split '\s+')[-1]
    Write-Host "  Found PID: $pid3200" -ForegroundColor Yellow

    # Get process details
    $proc = Get-Process -Id $pid3200 -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "  Process: $($proc.ProcessName)" -ForegroundColor Yellow
        Write-Host "  Path: $($proc.Path)" -ForegroundColor Gray
    }

    # Kill the process
    Write-Host "  Killing process $pid3200..." -ForegroundColor Cyan
    Stop-Process -Id $pid3200 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # Verify killed
    $stillExists = Get-Process -Id $pid3200 -ErrorAction SilentlyContinue
    if ($stillExists) {
        Write-Host "  Failed to kill process!" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "  Process killed successfully" -ForegroundColor Green
    }
} else {
    Write-Host "  No process found on port 3200" -ForegroundColor Green
}

Write-Host ""

# Step 2: Trigger API services reload
Write-Host "Step 2: Triggering API services reload..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3901/reload" -TimeoutSec 5
    Write-Host "  Reload triggered: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "  Failed to trigger reload: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 10

# Step 3: Verify InspireContinuum is running on port 3200
Write-Host ""
Write-Host "Step 3: Verifying InspireContinuum..." -ForegroundColor Cyan

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
    }
} catch {
    Write-Host "  Failed to check health: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Test InspireContinuum endpoint
Write-Host ""
Write-Host "Step 4: Testing InspireContinuum health..." -ForegroundColor Cyan
try {
    $result = Invoke-WebRequest -Uri "http://localhost:3200/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  HTTP $($result.StatusCode): OK" -ForegroundColor Green
} catch {
    if ($_.Exception.Response) {
        Write-Host "  HTTP $($_.Exception.Response.StatusCode): $($_.Exception.Message)" -ForegroundColor Red
    } else {
        Write-Host "  Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to close." -ForegroundColor Gray
Read-Host
