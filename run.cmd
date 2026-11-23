@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv || goto :error
)

echo Checking dependencies...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt || goto :error

set "PYTHONPATH=%~dp0"
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 4; Start-Process 'http://127.0.0.1:8000'"
echo Clip Studio running at http://127.0.0.1:8000  (Ctrl+C to stop)
".venv\Scripts\python.exe" -m uvicorn clipping.app:app --host 127.0.0.1 --port 8000
goto :eof

:error
echo Setup failed. Make sure Python 3.10+ and ffmpeg are installed and on PATH.
pause
