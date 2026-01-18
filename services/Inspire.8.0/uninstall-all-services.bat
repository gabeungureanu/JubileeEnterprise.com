@echo off
echo ============================================================
echo   Inspire 8.0: Uninstall All Services
echo ============================================================
echo.
echo This script will uninstall all 5 Inspire 8.0 Windows Services.
echo Run this script as Administrator.
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo [1/5] Uninstalling Self-Healing Services...
cd /d "%~dp0..\Inspire.SelfHealing"
call uninstall-service.bat
echo Done.

echo.
echo [2/5] Uninstalling Website Services...
cd /d "%~dp0"
node uninstall-website-services.cjs
echo Done.

echo.
echo [3/5] Uninstalling Web API Services...
node uninstall-api-services.cjs
echo Done.

echo.
echo [4/5] Uninstalling Cloudflared Services...
node uninstall-cloudflared-services.cjs
echo Done.

echo.
echo [5/5] Uninstalling Docker Services...
node uninstall-docker-services.cjs
echo Done.

echo.
echo ============================================================
echo   All Inspire 8.0 Services Uninstalled!
echo ============================================================
echo.
pause
