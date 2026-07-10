# Start backend with the correct python interpreter and uvicorn
# Usage: .\run_backend.ps1
$venvPython = "venv\Scripts\python.exe"
if (-Not (Test-Path $venvPython)) {
  Write-Host "Python executable not found at $venvPython. Activate your virtualenv or adjust the path." -ForegroundColor Red
  exit 1
}
& $venvPython -m uvicorn main:app --reload --port 8000
