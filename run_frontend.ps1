# Start frontend dev server
# Usage: .\run_frontend.ps1
Push-Location frontend
if (-Not (Test-Path "node_modules")) {
  Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
  npm install
}
npm run dev
Pop-Location
