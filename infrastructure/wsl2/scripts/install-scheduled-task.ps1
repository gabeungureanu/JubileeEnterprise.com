# Install Windows Scheduled Task for Jubilee Auto-Start
# ARCH-0007: WSL2 + systemd Architecture
#
# Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File install-scheduled-task.ps1

$ErrorActionPreference = "Stop"

$TaskName = "JubileeEnterpriseAutoStart"
$TaskDescription = "Starts Jubilee Enterprise services in WSL2 on system boot (ARCH-0007)"
$ScriptPath = "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Jubilee Enterprise Scheduled Task Installer"
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if task already exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Write-Host "Task '$TaskName' already exists. Removing..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the task
Write-Host "Creating scheduled task..." -ForegroundColor Green

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

$Trigger = New-ScheduledTaskTrigger -AtStartup
$Trigger.Delay = "PT30S"  # 30 second delay after boot

$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

$Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description $TaskDescription

Register-ScheduledTask -TaskName $TaskName -InputObject $Task | Out-Null

Write-Host ""
Write-Host "Task '$TaskName' created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Task Details:" -ForegroundColor Cyan
Write-Host "  Name:        $TaskName"
Write-Host "  Trigger:     At system startup (30s delay)"
Write-Host "  Run As:      SYSTEM"
Write-Host "  Script:      $ScriptPath"
Write-Host ""
Write-Host "To test the task manually:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "To view task status:" -ForegroundColor Yellow
Write-Host "  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host ""
