@echo off
setlocal

:: Check for admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

echo.
echo ============================================
echo   Restarting wwBibleweb.com Service
echo ============================================
echo.

echo Stopping service...
net stop wwbibleweb.exe
timeout /t 3 /nobreak >nul

echo Starting service...
net start wwbibleweb.exe
timeout /t 5 /nobreak >nul

echo.
echo Testing port 3116...
powershell -Command "$l = Get-NetTCPConnection -LocalPort 3116 -EA SilentlyContinue; if ($l) { Write-Host 'SUCCESS: Port 3116 listening!' -ForegroundColor Green } else { Write-Host 'Port not ready yet' -ForegroundColor Yellow }"

echo.
pause
