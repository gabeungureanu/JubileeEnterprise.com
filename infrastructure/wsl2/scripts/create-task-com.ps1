# Create Jubilee Auto-Start Task using Task Scheduler COM API
# Run this script as Administrator

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Jubilee Enterprise Auto-Start Installer   "
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Must run as Administrator!" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

$TaskName = "JubileeEnterpriseAutoStart"
$TaskFolder = "\"
$Description = "Starts Jubilee Enterprise services in WSL2 on system boot (ARCH-0007)"
$ScriptPath = "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1"

Write-Host "Creating scheduled task..." -ForegroundColor Green

try {
    # Create the Task Scheduler COM object
    $scheduler = New-Object -ComObject Schedule.Service
    $scheduler.Connect()

    # Get the root folder
    $rootFolder = $scheduler.GetFolder($TaskFolder)

    # Remove existing task if present
    try {
        $rootFolder.DeleteTask($TaskName, 0)
        Write-Host "Removed existing task" -ForegroundColor Yellow
    } catch {}

    # Create new task definition
    $taskDef = $scheduler.NewTask(0)

    # Registration info
    $taskDef.RegistrationInfo.Description = $Description
    $taskDef.RegistrationInfo.Author = "Jubilee Enterprise"

    # Settings
    $taskDef.Settings.Enabled = $true
    $taskDef.Settings.AllowDemandStart = $true
    $taskDef.Settings.StartWhenAvailable = $true
    $taskDef.Settings.RunOnlyIfNetworkAvailable = $true
    $taskDef.Settings.DisallowStartIfOnBatteries = $false
    $taskDef.Settings.StopIfGoingOnBatteries = $false
    $taskDef.Settings.ExecutionTimeLimit = "PT0S"  # No limit

    # Trigger - At startup with 30s delay
    $trigger = $taskDef.Triggers.Create(8)  # 8 = boot trigger
    $trigger.Enabled = $true
    $trigger.Delay = "PT30S"

    # Action - Run PowerShell script
    $action = $taskDef.Actions.Create(0)  # 0 = exec action
    $action.Path = "powershell.exe"
    $action.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

    # Principal - Run as SYSTEM with highest privileges
    $taskDef.Principal.UserId = "SYSTEM"
    $taskDef.Principal.LogonType = 5  # Service account
    $taskDef.Principal.RunLevel = 1   # Highest

    # Register the task
    $rootFolder.RegisterTaskDefinition($TaskName, $taskDef, 6, $null, $null, 3)

    Write-Host ""
    Write-Host "Task '$TaskName' created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To test manually: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Cyan
    Write-Host ""

} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
