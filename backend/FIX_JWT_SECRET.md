# Fix JWT_SECRET Error

## Quick Fix

The server requires `JWT_SECRET` and `SESSION_SECRET` in your `.env` file.

### Option 1: Run the Script (Easiest)

```powershell
cd backend
node add-secrets.js
```

Or:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File add-secrets.ps1
```

### Option 2: Manual Fix

1. Open `backend/.env` in a text editor
2. Add these lines (if they don't exist):

```env
# JWT / AUTH (REQUIRED - Use strong random strings, minimum 32 characters)
JWT_SECRET=your-very-strong-random-secret-minimum-32-characters-long
SESSION_SECRET=your-very-strong-random-session-secret-minimum-32-characters-long
```

3. Replace the placeholder values with actual random strings (64 characters each recommended)

### Option 3: Generate Secrets Using Node.js

Run this command to generate secure secrets:

```powershell
cd backend
node -e "const crypto = require('crypto'); console.log('JWT_SECRET=' + crypto.randomBytes(32).toString('hex')); console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('hex'));"
```

Copy the output and add it to your `.env` file.

### After Adding Secrets

1. Save the `.env` file
2. Restart your server:
   ```powershell
   npm start
   ```

The server should now start without the JWT_SECRET error!
