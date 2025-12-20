# PowerShell script to add JWT_SECRET and SESSION_SECRET to .env file

Write-Host "🔐 Setting up JWT_SECRET and SESSION_SECRET..." -ForegroundColor Cyan

# Generate secrets using Node.js
$jwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>&1 | Out-String -Stream | Select-Object -First 1 | ForEach-Object { $_.Trim() }
$sessionSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>&1 | Out-String -Stream | Select-Object -First 1 | ForEach-Object { $_.Trim() }

if (-not $jwtSecret -or $jwtSecret.Length -lt 32) {
    Write-Host "❌ Failed to generate JWT_SECRET" -ForegroundColor Red
    exit 1
}

if (-not $sessionSecret -or $sessionSecret.Length -lt 32) {
    Write-Host "❌ Failed to generate SESSION_SECRET" -ForegroundColor Red
    exit 1
}

# Read existing .env file
$envPath = ".env"
$envContent = ""

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
} else {
    Write-Host "⚠️  .env file not found. Creating new one..." -ForegroundColor Yellow
    New-Item -Path $envPath -ItemType File | Out-Null
}

# Check if secrets already exist
$hasJwt = $envContent -match "JWT_SECRET\s*="
$hasSession = $envContent -match "SESSION_SECRET\s*="

$linesToAdd = @()

if (-not $hasJwt) {
    $linesToAdd += ""
    $linesToAdd += "# JWT / AUTH (REQUIRED - Generated automatically)"
    $linesToAdd += "JWT_SECRET=$jwtSecret"
    Write-Host "✅ Generated JWT_SECRET" -ForegroundColor Green
} else {
    Write-Host "ℹ️  JWT_SECRET already exists in .env" -ForegroundColor Yellow
}

if (-not $hasSession) {
    if (-not $hasJwt) {
        # Comment already added above
    } else {
        $linesToAdd += ""
        $linesToAdd += "# SESSION_SECRET (REQUIRED - Generated automatically)"
    }
    $linesToAdd += "SESSION_SECRET=$sessionSecret"
    Write-Host "✅ Generated SESSION_SECRET" -ForegroundColor Green
} else {
    Write-Host "ℹ️  SESSION_SECRET already exists in .env" -ForegroundColor Yellow
}

# Append to .env file
if ($linesToAdd.Count -gt 0) {
    Add-Content -Path $envPath -Value ($linesToAdd -join "`n")
    Write-Host ""
    Write-Host "✅ Successfully added secrets to .env file!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Secrets generated:" -ForegroundColor Cyan
    if (-not $hasJwt) {
        Write-Host "   JWT_SECRET=$($jwtSecret.Substring(0, 20))..." -ForegroundColor Gray
    }
    if (-not $hasSession) {
        Write-Host "   SESSION_SECRET=$($sessionSecret.Substring(0, 20))..." -ForegroundColor Gray
    }
} else {
    Write-Host ""
    Write-Host "✅ All secrets already exist in .env file" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 You can now start the server with: npm start" -ForegroundColor Cyan
