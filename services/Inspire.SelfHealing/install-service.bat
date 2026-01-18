@echo off
echo ====================================================
echo  Installing Inspire 8.0: Self-Healing Windows Service
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
set SERVICE_DISPLAY="Inspire 8.0: Self-Healing"
set SERVICE_DESC="Health monitoring and automatic recovery service for Jubilee Enterprise websites and services"
set SERVICE_PATH=%~dp0Inspire.SelfHealing\publish\Inspire.SelfHealing.exe

echo Service Path: %SERVICE_PATH%
echo.

:: Check if service already exists
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Service already exists. Stopping and removing...
    sc stop %SERVICE_NAME% >nul 2>&1
    timeout /t 3 /nobreak >nul
    sc delete %SERVICE_NAME%
    timeout /t 2 /nobreak >nul
)

:: Create the Windows Event Log source
echo Creating Windows Event Log source...
powershell -Command "if (-not [System.Diagnostics.EventLog]::SourceExists('Inspire.SelfHealing')) { [System.Diagnostics.EventLog]::CreateEventSource('Inspire.SelfHealing', 'Application') }"

:: Install the service
echo Installing service...
sc create %SERVICE_NAME% binPath= "%SERVICE_PATH%" start= auto DisplayName= %SERVICE_DISPLAY%

if %errorLevel% neq 0 (
    echo ERROR: Failed to create service.
    pause
    exit /b 1
)

:: Set service description
sc description %SERVICE_NAME% %SERVICE_DESC%

:: Configure service recovery options (restart on failure)
sc failure %SERVICE_NAME% reset= 86400 actions= restart/60000/restart/60000/restart/60000

:: Start the service
echo Starting service...
sc start %SERVICE_NAME%

if %errorLevel% neq 0 (
    echo WARNING: Service may need to be started manually.
) else (
    echo Service started successfully!
)

echo.
echo ====================================================
echo  Installation Complete!
echo ====================================================
echo.
echo Service Status:
sc query %SERVICE_NAME%

pause
