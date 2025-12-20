# Quick Fix Script - Add JWT_SECRET and SESSION_SECRET to .env

Write-Host "🔧 Adding JWT_SECRET and SESSION_SECRET to .env file..." -ForegroundColor Cyan

# Generate secrets
$jwtSecret = node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'));" | Out-String | ForEach-Object { $_.Trim() }
$sessionSecret = node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'));" | Out-String | ForEach-Object { $_.Trim() }

# Read .env file
$envPath = ".env"
if (Test-Path $envPath) {
    $content = Get-Content $envPath -Raw
} else {
    $content = ""
    Write-Host "Creating new .env file..." -ForegroundColor Yellow
}

# Check and add JWT_SECRET
if ($content -notmatch "(?m)^JWT_SECRET=") {
    if ($content -and -not $content.EndsWith("`n")) { $content += "`n" }
    $content += "`n# JWT / AUTH (REQUIRED)`n"
    $content += "JWT_SECRET=$jwtSecret`n"
    Write-Host "✅ Added JWT_SECRET" -ForegroundColor Green
} else {
    Write-Host "⚠️  JWT_SECRET already exists" -ForegroundColor Yellow
}

# Check and add SESSION_SECRET
if ($content -notmatch "(?m)^SESSION_SECRET=") {
    $content += "SESSION_SECRET=$sessionSecret`n"
    Write-Host "✅ Added SESSION_SECRET" -ForegroundColor Green
} else {
    Write-Host "⚠️  SESSION_SECRET already exists" -ForegroundColor Yellow
}

# Write back to file
[System.IO.File]::WriteAllText((Resolve-Path $envPath -ErrorAction SilentlyContinue) ?? (Join-Path $PWD $envPath), $content, [System.Text.Encoding]::UTF8)

Write-Host "`n✅ Done! Your .env file has been updated." -ForegroundColor Green
Write-Host "You can now start your server with: npm start`n" -ForegroundColor Cyan
