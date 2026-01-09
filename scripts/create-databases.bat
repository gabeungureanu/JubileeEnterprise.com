@echo off
REM =====================================================
REM Create Databases Script for Jubilee Enterprise
REM =====================================================

echo.
echo =====================================================
echo Creating Jubilee Enterprise Databases
echo =====================================================
echo.

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Execute PowerShell script
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%create-databases.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Script completed successfully!
) else (
    echo.
    echo Script failed with error code: %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)

pause
