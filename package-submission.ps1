# Build the clean submission archive in .\release\
# Usage:  .\package-submission.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Error "Backend virtualenv not found at $python. Follow README.md > Run locally > step 2."
    exit 1
}

Push-Location $root
try {
    & $python "scripts\package.py"
} finally {
    Pop-Location
}
