const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Generate secure random secrets
const jwtSecret = crypto.randomBytes(32).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');

// Read existing .env file
let envContent = '';
if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
}

// Check if secrets already exist
const hasJwtSecret = /^JWT_SECRET=/.test(envContent);
const hasSessionSecret = /^SESSION_SECRET=/.test(envContent);

// Add or update JWT_SECRET
if (!hasJwtSecret) {
    envContent += `\n# JWT / AUTH (REQUIRED - Use strong random strings, minimum 32 characters)\n`;
    envContent += `JWT_SECRET=${jwtSecret}\n`;
    console.log('✅ Added JWT_SECRET to .env');
} else {
    console.log('⚠️  JWT_SECRET already exists in .env');
}

// Add or update SESSION_SECRET
if (!hasSessionSecret) {
    if (!hasJwtSecret) {
        // Already added the comment above
    } else {
        envContent += `\n# Session Secret (REQUIRED)\n`;
    }
    envContent += `SESSION_SECRET=${sessionSecret}\n`;
    console.log('✅ Added SESSION_SECRET to .env');
} else {
    console.log('⚠️  SESSION_SECRET already exists in .env');
}

// Write back to .env file
fs.writeFileSync(envPath, envContent, 'utf8');

console.log('\n✅ Secrets have been added to your .env file!');
console.log('You can now start your server with: npm start\n');
