param([switch]$Elevated)

$TaskName = "JubileeEnterpriseAutoStart"
$ScriptPath = "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1"
$LogFile = "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\logs\task-install.log"

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
Log "Jubilee Enterprise Task Installer"
Log "=========================================="

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Log "Running as Administrator: $isAdmin"

if (-not $isAdmin) {
    Log "Requesting elevation..."
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Elevated" -Verb RunAs -Wait
    exit
}

Log "Creating scheduled task..."

try {
    # Remove existing
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Log "Removing existing task..."
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    # Create new task
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Trigger.Delay = "PT30S"
    $Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "Starts Jubilee Enterprise services in WSL2 on system boot (ARCH-0007)" -Force

    Log "SUCCESS: Task created!"

    $task = Get-ScheduledTask -TaskName $TaskName
    Log "Task Name: $($task.TaskName)"
    Log "Task State: $($task.State)"

} catch {
    Log "ERROR: $($_.Exception.Message)"
}

Log "=========================================="
Log "Done"
