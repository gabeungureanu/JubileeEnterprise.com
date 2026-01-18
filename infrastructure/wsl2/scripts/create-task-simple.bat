@echo off
setlocal

:: Must be run as Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Must run as Administrator!
    pause
    exit /b 1
)

echo Creating Jubilee Enterprise Auto-Start Task...

schtasks /Create /TN "JubileeEnterpriseAutoStart" /SC ONSTART /DELAY 0000:30 /TR "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1\"" /RU SYSTEM /RL HIGHEST /F

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: Task created!
    echo.
    schtasks /Query /TN "JubileeEnterpriseAutoStart" /V /FO LIST | findstr /i "taskname status"
) else (
    echo.
    echo ERROR: Failed to create task
)

echo.
pause
