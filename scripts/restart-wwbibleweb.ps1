param([switch]$Elevated)

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Requesting elevation..."
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Elevated" -Verb RunAs -Wait
    exit
}

Write-Host "Stopping wwBibleweb service..." -ForegroundColor Yellow
Stop-Service -Name "wwbibleweb.exe" -Force
Start-Sleep -Seconds 3

Write-Host "Starting wwBibleweb service..." -ForegroundColor Yellow
Start-Service -Name "wwbibleweb.exe"
Start-Sleep -Seconds 5

Write-Host "Waiting for port 3116..." -ForegroundColor Yellow
$maxRetries = 15
for ($i = 0; $i -lt $maxRetries; $i++) {
    $listener = Get-NetTCPConnection -LocalPort 3116 -ErrorAction SilentlyContinue
    if ($listener) {
        Write-Host "SUCCESS: Port 3116 is listening!" -ForegroundColor Green

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3116/" -TimeoutSec 5 -UseBasicParsing
            Write-Host "HTTP OK: $($response.StatusCode)" -ForegroundColor Green
        } catch {
            Write-Host "HTTP test: $($_.Exception.Message)" -ForegroundColor Yellow
        }
        break
    }
    Write-Host "Waiting... ($($i+1)/$maxRetries)"
    Start-Sleep -Seconds 2
}

if (-not $listener) {
    Write-Host "ERROR: Port 3116 never started" -ForegroundColor Red
}

Read-Host "Press Enter to close"
