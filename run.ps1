# Start the AIVOA RCA demo as a single URL: FastAPI serves the built React app.
# Usage:  .\run.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root "backend\.venv\Scripts\python.exe"
$dist = Join-Path $root "frontend\dist\index.html"

if (-not (Test-Path $python)) {
    Write-Error "Backend virtualenv not found at $python. Follow README.md > Run locally > step 2."
    exit 1
}

if (-not (Test-Path $dist)) {
    Write-Error "frontend\dist is missing. Run: cd frontend; npm install; npm run build"
    exit 1
}

$busy = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Error "Port 8000 is already in use (PID $($busy[0].OwningProcess)). Stop that process, then retry."
    exit 1
}

Write-Host ""
Write-Host "  AIVOA RCA" -ForegroundColor Cyan
Write-Host "  http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  API docs: http://127.0.0.1:8000/docs" -ForegroundColor DarkGray
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

Push-Location (Join-Path $root "backend")
try {
    & $python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
} finally {
    Pop-Location
}
