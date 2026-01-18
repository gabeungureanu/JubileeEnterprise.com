# Register Jubilee Enterprise Auto-Start Task
# Must be run as Administrator

$TaskName = "JubileeEnterpriseAutoStart"
$TaskPath = "\"  # Root of Task Scheduler

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task"
}

# Create the task
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1"'

$Trigger = New-ScheduledTaskTrigger -AtStartup
$Trigger.Delay = "PT30S"

$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Starts Jubilee Enterprise services in WSL2 on system boot (ARCH-0007)"

Register-ScheduledTask -TaskName $TaskName -InputObject $Task

Write-Host "Task '$TaskName' registered successfully!"
Get-ScheduledTask -TaskName $TaskName | Format-List TaskName, State
