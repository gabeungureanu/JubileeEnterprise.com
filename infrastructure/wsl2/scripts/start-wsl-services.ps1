# Jubilee Enterprise WSL2 Auto-Start Script
# ARCH-0007: WSL2 + systemd Architecture
#
# This script starts WSL2 and Jubilee services on Windows boot.
# Install as Windows Task Scheduler task with:
#   - Trigger: At system startup
#   - Action: powershell.exe -ExecutionPolicy Bypass -File "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1"
#   - Run whether user is logged on or not
#   - Run with highest privileges

$ErrorActionPreference = "Continue"
$LogFile = "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\logs\startup-$(Get-Date -Format 'yyyy-MM-dd').log"

# Ensure log directory exists
$LogDir = Split-Path $LogFile -Parent
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

Write-Log "============================================"
Write-Log "Jubilee Enterprise WSL2 Auto-Start"
Write-Log "ARCH-0007: WSL2 + systemd Architecture"
Write-Log "============================================"

# Wait for network to be available
Write-Log "Waiting for network..."
$NetworkReady = $false
$MaxNetworkWait = 60
$NetworkWaitCount = 0

while (-not $NetworkReady -and $NetworkWaitCount -lt $MaxNetworkWait) {
    try {
        $null = Test-Connection -ComputerName "8.8.8.8" -Count 1 -Quiet
        $NetworkReady = $true
        Write-Log "Network is available"
    } catch {
        $NetworkWaitCount++
        Start-Sleep -Seconds 1
    }
}

if (-not $NetworkReady) {
    Write-Log "WARNING: Network not available after ${MaxNetworkWait}s, continuing anyway..."
}

# Start WSL2 and systemd services
Write-Log "Starting WSL2 and Jubilee services..."

try {
    # This command starts WSL2 and triggers systemd
    $result = wsl -d Ubuntu-24.04 -- systemctl start jubilee.target 2>&1
    Write-Log "systemctl start jubilee.target: $result"
} catch {
    Write-Log "ERROR starting jubilee.target: $_"
}

# Wait for services to start
Write-Log "Waiting for services to become healthy..."
Start-Sleep -Seconds 30

# Verify health endpoints
$HealthEndpoints = @(
    @{ Name = "Nginx Health"; Url = "http://localhost:3900/health" },
    @{ Name = "InspireCodex API"; Url = "http://localhost:3100/health" },
    @{ Name = "JubileeVerse"; Url = "http://localhost:3000/" }
)

$MaxRetries = 30
$RetryDelay = 10
$AllHealthy = $false
$RetryCount = 0

while (-not $AllHealthy -and $RetryCount -lt $MaxRetries) {
    $AllHealthy = $true

    foreach ($Endpoint in $HealthEndpoints) {
        try {
            $Response = Invoke-WebRequest -Uri $Endpoint.Url -TimeoutSec 5 -UseBasicParsing
            if ($Response.StatusCode -eq 200) {
                Write-Log "$($Endpoint.Name): OK (200)"
            } else {
                Write-Log "$($Endpoint.Name): Status $($Response.StatusCode)"
                $AllHealthy = $false
            }
        } catch {
            Write-Log "$($Endpoint.Name): Not responding yet"
            $AllHealthy = $false
        }
    }

    if (-not $AllHealthy) {
        $RetryCount++
        Write-Log "Retry $RetryCount/$MaxRetries - waiting ${RetryDelay}s..."
        Start-Sleep -Seconds $RetryDelay
    }
}

if ($AllHealthy) {
    Write-Log "============================================"
    Write-Log "All Jubilee services started successfully!"
    Write-Log "============================================"
    exit 0
} else {
    Write-Log "============================================"
    Write-Log "WARNING: Some services may not be healthy"
    Write-Log "Check with: wsl -d Ubuntu-24.04 -- systemctl status jubilee.target"
    Write-Log "============================================"
    exit 1
}
