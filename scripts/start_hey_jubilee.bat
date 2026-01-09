@echo off
REM Hey Jubilee - Wake Word Listener Launcher
REM
REM This starts the wake word listener that triggers VS Code dictation
REM when you say "Hey Jubilee" (or "Jarvis" if using built-in keyword)

cd /d "%~dp0"

echo.
echo ========================================
echo   Hey Jubilee - Wake Word Listener
echo ========================================
echo.

REM Check if PICOVOICE_ACCESS_KEY is set
if "%PICOVOICE_ACCESS_KEY%"=="" (
    echo WARNING: PICOVOICE_ACCESS_KEY environment variable not set.
    echo.
    echo To set it permanently in Windows:
    echo   1. Open System Properties ^> Advanced ^> Environment Variables
    echo   2. Add new User variable: PICOVOICE_ACCESS_KEY
    echo   3. Set value to your key from https://console.picovoice.ai/
    echo.
    echo Or set it for this session:
    echo   set PICOVOICE_ACCESS_KEY=your-key-here
    echo.
)

python hey_jubilee.py --use-jarvis %*

pause
