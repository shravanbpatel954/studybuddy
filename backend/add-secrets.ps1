# PowerShell script to add JWT_SECRET and SESSION_SECRET to .env file

$envFile = ".env"

# Check if .env exists
if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    New-Item -ItemType File -Path $envFile | Out-Null
}

# Read existing content
$content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue
if ($null -eq $content) {
    $content = ""
}

# Generate secure random secrets using Node.js
Write-Host "Generating secure secrets..." -ForegroundColor Cyan

$jwtSecret = node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'));"
$sessionSecret = node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'));"

# Remove any trailing whitespace/newlines
$jwtSecret = $jwtSecret.Trim()
$sessionSecret = $sessionSecret.Trim()

# Check if secrets already exist
$hasJwt = $content -match "^JWT_SECRET="
$hasSession = $content -match "^SESSION_SECRET="

# Add JWT_SECRET if missing
if (-not $hasJwt) {
    if ($content -and -not $content.EndsWith("`n") -and -not $content.EndsWith("`r")) {
        $content += "`n"
    }
    $content += "`n# JWT / AUTH (REQUIRED - Use strong random strings, minimum 32 characters)`n"
    $content += "JWT_SECRET=$jwtSecret`n"
    Write-Host "✅ Added JWT_SECRET" -ForegroundColor Green
} else {
    Write-Host "⚠️  JWT_SECRET already exists" -ForegroundColor Yellow
}

# Add SESSION_SECRET if missing
if (-not $hasSession) {
    if (-not $hasJwt) {
        if ($content -and -not $content.EndsWith("`n") -and -not $content.EndsWith("`r")) {
            $content += "`n"
        }
        $content += "`n# Session Secret (REQUIRED)`n"
    }
    $content += "SESSION_SECRET=$sessionSecret`n"
    Write-Host "✅ Added SESSION_SECRET" -ForegroundColor Green
} else {
    Write-Host "⚠️  SESSION_SECRET already exists" -ForegroundColor Yellow
}

# Write back to file
$content | Set-Content $envFile -NoNewline

Write-Host "`n✅ Done! Your .env file has been updated." -ForegroundColor Green
Write-Host "You can now start your server with: npm start`n" -ForegroundColor Cyan
