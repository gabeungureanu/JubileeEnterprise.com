# Force Kill Legacy JubileeBrowser Windows Service
# Run as Administrator

$ErrorActionPreference = "Continue"

Write-Host "=== Force Kill Legacy JubileeBrowser ===" -ForegroundColor Yellow
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting elevation..." -ForegroundColor Cyan
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

# Kill the jubileebrowser.exe process tree
Write-Host "Killing jubileebrowser.exe process tree..." -ForegroundColor Cyan
$jbProc = Get-Process -Name "jubileebrowser" -ErrorAction SilentlyContinue
if ($jbProc) {
    Write-Host "  Found jubileebrowser.exe PID: $($jbProc.Id)" -ForegroundColor Yellow

    # Kill child processes first
    $children = Get-WmiObject Win32_Process | Where-Object { $_.ParentProcessId -eq $jbProc.Id }
    foreach ($child in $children) {
        Write-Host "  Killing child PID: $($child.ProcessId) ($($child.Name))" -ForegroundColor Yellow
        Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue

        # Kill grandchildren
        $grandchildren = Get-WmiObject Win32_Process | Where-Object { $_.ParentProcessId -eq $child.ProcessId }
        foreach ($gc in $grandchildren) {
            Write-Host "    Killing grandchild PID: $($gc.ProcessId) ($($gc.Name))" -ForegroundColor Yellow
            Stop-Process -Id $gc.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }

    # Now kill the parent
    Stop-Process -Id $jbProc.Id -Force -ErrorAction SilentlyContinue
    Write-Host "  Killed jubileebrowser.exe" -ForegroundColor Green
} else {
    Write-Host "  jubileebrowser.exe not found" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# Disable the service
Write-Host ""
Write-Host "Disabling service..." -ForegroundColor Cyan
Set-Service -Name "jubileebrowser.exe" -StartupType Disabled -ErrorAction SilentlyContinue
Write-Host "  Service disabled" -ForegroundColor Green

# Verify port 3200 is free
Write-Host ""
Write-Host "Verifying port 3200..." -ForegroundColor Cyan
$netstat = netstat -ano | Select-String ":3200.*LISTENING"
if ($netstat) {
    $pid3200 = ($netstat -split '\s+')[-1]
    Write-Host "  WARNING: Port 3200 still in use by PID: $pid3200" -ForegroundColor Red
} else {
    Write-Host "  Port 3200 is now FREE!" -ForegroundColor Green
}

# Trigger API services reload
Write-Host ""
Write-Host "Triggering API services reload..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3901/reload" -TimeoutSec 5
    Write-Host "  Reload triggered: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "  Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 10

# Final verification
Write-Host ""
Write-Host "Final verification..." -ForegroundColor Cyan
$netstat2 = netstat -ano | Select-String ":3200.*LISTENING"
if ($netstat2) {
    $newPid = ($netstat2 -split '\s+')[-1]
    $proc = Get-Process -Id $newPid -ErrorAction SilentlyContinue
    Write-Host "  Port 3200 now owned by: $($proc.ProcessName) (PID: $newPid)" -ForegroundColor Green
} else {
    Write-Host "  Port 3200 not bound" -ForegroundColor Yellow
}

try {
    $result = Invoke-WebRequest -Uri "http://localhost:3200/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "  InspireContinuum health: OK" -ForegroundColor Green
} catch {
    Write-Host "  InspireContinuum health check failed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Yellow
Write-Host "Press Enter to close." -ForegroundColor Gray
Read-Host
