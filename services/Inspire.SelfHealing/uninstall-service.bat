@echo off
echo ====================================================
echo  Uninstalling Inspire 8.0: Self-Healing Windows Service
echo ====================================================
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

set SERVICE_NAME=Inspire.SelfHealing

:: Stop the service
echo Stopping service...
sc stop %SERVICE_NAME% >nul 2>&1
timeout /t 3 /nobreak >nul

:: Delete the service
echo Removing service...
sc delete %SERVICE_NAME%

if %errorLevel% equ 0 (
    echo Service removed successfully!
) else (
    echo Service may already be removed or does not exist.
)

echo.
echo ====================================================
echo  Uninstallation Complete!
echo ====================================================

pause
