@echo off
setlocal

set LOGFILE=C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\logs\task-install.log

echo ============================================ > "%LOGFILE%"
echo   Task Installation Log >> "%LOGFILE%"
echo   %date% %time% >> "%LOGFILE%"
echo ============================================ >> "%LOGFILE%"
echo. >> "%LOGFILE%"

:: Check for admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo NOT ADMIN - Elevating... >> "%LOGFILE%"
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

echo Running as Administrator >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo Creating scheduled task... >> "%LOGFILE%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { ^
     $Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1\"'; ^
     $Trigger = New-ScheduledTaskTrigger -AtStartup; ^
     $Trigger.Delay = 'PT30S'; ^
     $Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest; ^
     $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable; ^
     Register-ScheduledTask -TaskName 'JubileeEnterpriseAutoStart' -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description 'Starts Jubilee Enterprise services in WSL2 on system boot' -Force | Out-File -Append '%LOGFILE%'; ^
     'SUCCESS' | Out-File -Append '%LOGFILE%'; ^
   } catch { ^
     'ERROR: ' + $_.Exception.Message | Out-File -Append '%LOGFILE%'; ^
   }"

echo. >> "%LOGFILE%"
echo Done. >> "%LOGFILE%"

echo Task creation attempted. Check log file: %LOGFILE%
pause
