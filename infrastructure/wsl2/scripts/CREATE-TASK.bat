@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo   Jubilee Enterprise Auto-Start Installer
echo ============================================
echo.

:: Check for admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

echo Running with administrator privileges...
echo.

:: Use PowerShell to create the task (handles spaces better)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1\"'; ^
   $Trigger = New-ScheduledTaskTrigger -AtStartup; ^
   $Trigger.Delay = 'PT30S'; ^
   $Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest; ^
   $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable; ^
   Register-ScheduledTask -TaskName 'JubileeEnterpriseAutoStart' -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description 'Starts Jubilee Enterprise services in WSL2 on system boot (ARCH-0007)' -Force; ^
   Get-ScheduledTask -TaskName 'JubileeEnterpriseAutoStart' | Format-List TaskName, State"

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   SUCCESS! Task created!
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   ERROR: Failed to create task (code: %errorlevel%)
    echo ============================================
)

echo.
echo Press any key to exit...
pause >nul
