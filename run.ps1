# Starts the local web app and opens it in your browser.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# -----------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}

Write-Host "Checking dependencies..." -ForegroundColor Cyan
& .\.venv\Scripts\python.exe -m pip install --disable-pip-version-check -q -r requirements.txt

# Create .env from .env.example if missing (new config options need it)
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "Creating .env from .env.example..." -ForegroundColor Cyan
        Copy-Item ".env.example" ".env"
    }
}

# ffmpeg must be on PATH for transcription & rendering
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "`nERROR: ffmpeg is not installed or not on PATH.`nInstall ffmpeg and add its bin folder to PATH, then re-run.`n" -ForegroundColor Red
    exit 1
}

$env:PYTHONPATH = $PSScriptRoot

# -----------------------------------------------------------
# Start uvicorn in the background, wait until /health responds,
# then open the browser. (Old versions opened the browser before
# uvicorn was listening, leading to a blank "can't connect" page.)
# -----------------------------------------------------------
Write-Host "Starting Clip Studio API server..." -ForegroundColor Cyan

$uvicorn = Start-Process .\.venv\Scripts\python.exe `
    -ArgumentList "-m", "uvicorn", "clipping.app:app", "--host", "127.0.0.1", "--port", "8000" `
    -PassThru -WindowStyle Hidden

# Wait up to 60 seconds for the health endpoint
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep 1
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}

if (-not $ready) {
    Write-Host "Server did not become ready in time." -ForegroundColor Red
    Stop-Process -Id $uvicorn.Id -Force
    exit 1
}

Write-Host "Server ready. Opening browser..." -ForegroundColor Green
Start-Process "http://127.0.0.1:8000"
Write-Host "Clip Studio running at http://127.0.0.1:8000  (Ctrl+C to stop)" -ForegroundColor Green

# Keep the foreground attached to uvicorn so Ctrl+C stops the server.
Wait-Process -Id $uvicorn.Id
