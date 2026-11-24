@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: -----------------------------------------------------------
:: Pre-flight checks
:: -----------------------------------------------------------
if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv || goto :error
)

echo Checking dependencies...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt || goto :error

:: Create .env from .env.example if missing (new config options need it)
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env from .env.example...
        copy ".env.example" ".env" >nul
    )
)

:: ffmpeg must be on PATH for transcription & rendering
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: ffmpeg is not installed or not on PATH.
    echo Install ffmpeg and add its bin folder to PATH, then re-run.
    echo.
    goto :error
)

set "PYTHONPATH=%~dp0"

:: Launch a hidden PowerShell that waits for /health to be ready,
:: then opens the browser. This runs independently so uvicorn can
:: bind port 8000 in the foreground below without conflict.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
    "Start-Sleep 2; " ^
    "for ($i=0; $i -lt 60; $i++) { " ^
    "  try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2 -ErrorAction Stop; if ($r.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:8000'; break } } catch {} " ^
    "  Start-Sleep 1 " ^
    "}"

echo Starting Clip Studio API server...
echo Clip Studio running at http://127.0.0.1:8000  (Ctrl+C to stop)
echo.

:: Run uvicorn in the foreground so Ctrl+C stops the server cleanly.
".venv\Scripts\python.exe" -m uvicorn clipping.app:app --host 127.0.0.1 --port 8000
goto :eof

:error
echo.
echo Setup failed. Make sure Python 3.10+ and ffmpeg are installed and on PATH.
pause
