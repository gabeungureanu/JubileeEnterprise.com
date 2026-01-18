# Restart Inspire 8.0 Website Services
# Run as Administrator

$ErrorActionPreference = "Continue"

Write-Host "=== Restarting Inspire 8.0 Website Services ===" -ForegroundColor Yellow
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting elevation..." -ForegroundColor Cyan
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

Write-Host "Stopping inspire80websiteservices.exe..." -ForegroundColor Cyan
Stop-Service -Name "inspire80websiteservices.exe" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

Write-Host "Starting inspire80websiteservices.exe..." -ForegroundColor Cyan
Start-Service -Name "inspire80websiteservices.exe"
Start-Sleep -Seconds 10

$svc = Get-Service -Name "inspire80websiteservices.exe" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "Service started successfully!" -ForegroundColor Green
} else {
    Write-Host "Service may still be starting..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Testing key ports..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

$ports = @(
    @{Port=3000; Name="JubileeVerse"},
    @{Port=3001; Name="JubileeInspire"},
    @{Port=3003; Name="wwBibleweb"},
    @{Port=3300; Name="CelestialPaths"},
    @{Port=3400; Name="GoPartyGiggles"},
    @{Port=3100; Name="InspireCodex"}
)

foreach ($p in $ports) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($p.Port)/" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        Write-Host "  Port $($p.Port) ($($p.Name)): OK" -ForegroundColor Green
    } catch {
        Write-Host "  Port $($p.Port) ($($p.Name)): FAIL" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done! Press Enter to close." -ForegroundColor Yellow
Read-Host
