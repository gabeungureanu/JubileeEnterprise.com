@echo off
echo ====================================================
echo  Configuring Windows Services for Auto-Start
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

echo Setting Docker Desktop Service to auto-start...
sc config "com.docker.service" start= auto
if %errorLevel% equ 0 (
    echo   [OK] Docker Desktop Service set to AUTO_START
) else (
    echo   [WARN] Could not configure Docker Desktop Service
)

echo.
echo Starting Docker Desktop Service...
sc start "com.docker.service" >nul 2>&1
if %errorLevel% equ 0 (
    echo   [OK] Docker Desktop Service started
) else (
    echo   [INFO] Docker Desktop Service may already be running or needs manual start
)

echo.
echo ====================================================
echo  Current Service Configuration
echo ====================================================
echo.

echo Docker Desktop Service:
sc qc "com.docker.service" | findstr START_TYPE

echo.
echo Cloudflared:
sc qc Cloudflared | findstr START_TYPE

echo.
echo JubileeDailyNews:
sc qc JubileeDailyNews | findstr START_TYPE

echo.
echo ====================================================
echo  Configuration Complete!
echo ====================================================

pause
