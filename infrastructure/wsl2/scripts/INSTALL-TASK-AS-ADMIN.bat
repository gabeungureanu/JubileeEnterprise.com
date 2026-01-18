@echo off
:: Jubilee Enterprise - Install Scheduled Task
:: Double-click this file and approve the admin prompt
::
:: This will install the Windows Task Scheduler task that
:: starts WSL2 and Jubilee services on system boot.

echo.
echo ============================================
echo   Jubilee Enterprise Auto-Start Installer
echo ============================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Running with administrator privileges...
echo.

:: Run the PowerShell installer
powershell -ExecutionPolicy Bypass -File "%~dp0install-scheduled-task.ps1"

echo.
pause
