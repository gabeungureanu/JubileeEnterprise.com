@echo off
echo ============================================================
echo   Inspire 8.0: Install All Services
echo ============================================================
echo.
echo This script will install all 5 Inspire 8.0 Windows Services.
echo Run this script as Administrator.
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo [1/5] Installing Docker Services...
cd /d "%~dp0"
node install-docker-services.cjs
if errorlevel 1 (
    echo ERROR: Failed to install Docker Services
    pause
    exit /b 1
)

echo.
echo [2/5] Installing Cloudflared Services...
node install-cloudflared-services.cjs
if errorlevel 1 (
    echo ERROR: Failed to install Cloudflared Services
    pause
    exit /b 1
)

echo.
echo [3/5] Installing Web API Services...
node install-api-services.cjs
if errorlevel 1 (
    echo ERROR: Failed to install Web API Services
    pause
    exit /b 1
)

echo.
echo [4/5] Installing Website Services...
node install-website-services.cjs
if errorlevel 1 (
    echo ERROR: Failed to install Website Services
    pause
    exit /b 1
)

echo.
echo [5/5] Installing Self-Healing Services...
cd /d "%~dp0..\Inspire.SelfHealing"
call install-service.bat
if errorlevel 1 (
    echo ERROR: Failed to install Self-Healing Services
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   All Inspire 8.0 Services Installed Successfully!
echo ============================================================
echo.
echo Health Endpoints:
echo   - Website Services:    http://localhost:3900/health
echo   - Web API Services:    http://localhost:3901/health
echo   - Docker Services:     http://localhost:3902/health
echo   - Cloudflared Services: http://localhost:3903/health
echo.
echo Service Commands:
echo   sc query inspire80websiteservices.exe
echo   sc query inspire80webapiservices.exe
echo   sc query inspire80dockerservices.exe
echo   sc query inspire80cloudflaredservices.exe
echo   sc query "Inspire 8.0: Self-Healing"
echo.
pause
