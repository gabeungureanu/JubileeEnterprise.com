@echo off
echo ============================================
echo   Jubilee Enterprise Auto-Start Installer
echo ============================================
echo.

:: Check for admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Running with administrator privileges...
echo.

set SCRIPT_PATH=C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts\start-wsl-services.ps1

echo Creating scheduled task...
schtasks /Create /TN "JubileeEnterpriseAutoStart" /SC ONSTART /DELAY 0000:30 /TR "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%SCRIPT_PATH%\"" /RU SYSTEM /RL HIGHEST /F

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   SUCCESS! Task created successfully!
    echo ============================================
    echo.
    echo Task Name: JubileeEnterpriseAutoStart
    echo Trigger:   At system startup (30s delay)
    echo Run As:    SYSTEM
    echo.
) else (
    echo.
    echo ============================================
    echo   ERROR: Failed to create task
    echo   Error code: %errorlevel%
    echo ============================================
)

echo.
echo Press any key to exit...
pause >nul
