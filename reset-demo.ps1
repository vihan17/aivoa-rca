# Reset the AIVOA RCA demo database to the two seeded investigations.
# Run from anywhere:  .\reset-demo.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Error "Backend virtualenv not found at $python. Follow README.md > Run locally > step 2."
    exit 1
}

Push-Location $root
try {
    & $python "scripts\reset_demo.py"
} finally {
    Pop-Location
}
