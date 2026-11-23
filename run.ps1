# Starts the local web app and opens it in your browser.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}

Write-Host "Checking dependencies..." -ForegroundColor Cyan
& .\.venv\Scripts\python.exe -m pip install --disable-pip-version-check -q -r requirements.txt

$env:PYTHONPATH = $PSScriptRoot
Start-Process "http://127.0.0.1:8000"
Write-Host "Clip Studio running at http://127.0.0.1:8000  (Ctrl+C to stop)" -ForegroundColor Green
& .\.venv\Scripts\python.exe -m uvicorn clipping.app:app --host 127.0.0.1 --port 8000
