#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

console.log('🔧 Fixing .env file...\n');

const envPath = path.join(__dirname, '.env');

// Generate secure secrets
const jwtSecret = crypto.randomBytes(32).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');

// Read existing .env
let content = '';
if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
    console.log('✅ Found existing .env file');
} else {
    console.log('⚠️  .env file not found, creating new one...');
}

// Check if secrets exist
const hasJwt = /^JWT_SECRET=/m.test(content);
const hasSession = /^SESSION_SECRET=/m.test(content);

// Add JWT_SECRET if missing
if (!hasJwt) {
    if (content && !content.endsWith('\n')) {
        content += '\n';
    }
    content += '\n# JWT / AUTH (REQUIRED)\n';
    content += `JWT_SECRET=${jwtSecret}\n`;
    console.log('✅ Added JWT_SECRET');
} else {
    console.log('⚠️  JWT_SECRET already exists');
}

// Add SESSION_SECRET if missing
if (!hasSession) {
    content += `SESSION_SECRET=${sessionSecret}\n`;
    console.log('✅ Added SESSION_SECRET');
} else {
    console.log('⚠️  SESSION_SECRET already exists');
}

// Write to file
fs.writeFileSync(envPath, content, 'utf8');

console.log('\n✅ .env file updated successfully!');
console.log('You can now start your server with: npm start\n');
