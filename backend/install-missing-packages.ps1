# Install Missing Packages Script

Write-Host "🔧 Installing missing packages..." -ForegroundColor Cyan
Write-Host ""

# Install packages
npm install express-timeout-handler express-rate-limit validator --save

Write-Host ""
Write-Host "✅ Packages installed!" -ForegroundColor Green
Write-Host ""
Write-Host "Now try starting your server:" -ForegroundColor Yellow
Write-Host "  npm start" -ForegroundColor Cyan
Write-Host ""
