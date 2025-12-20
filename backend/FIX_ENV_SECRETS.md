# Fix: JWT_SECRET Missing Error

## Quick Fix

Your `.env` file is missing `JWT_SECRET` and `SESSION_SECRET`. Here's how to fix it:

### Option 1: Run the Setup Script (Recommended)

```powershell
cd backend
node add-secrets.js
```

Or use PowerShell:
```powershell
cd backend
powershell -ExecutionPolicy Bypass -File setup-secrets.ps1
```

### Option 2: Manual Fix

1. Open `backend/.env` in a text editor
2. Add these lines at the end of the file:

```env
# JWT / AUTH (REQUIRED)
JWT_SECRET=your-very-strong-random-secret-minimum-32-characters-long-here
SESSION_SECRET=your-very-strong-random-session-secret-minimum-32-characters-long-here
```

3. Replace the placeholder values with secure random strings (64 characters each)

### Option 3: Generate Secrets Manually

Run this in PowerShell to generate secrets:

```powershell
cd backend
node -e "const crypto=require('crypto'); console.log('JWT_SECRET='+crypto.randomBytes(32).toString('hex')); console.log('SESSION_SECRET='+crypto.randomBytes(32).toString('hex'));"
```

Copy the output and paste it into your `.env` file.

### After Adding Secrets

1. Save the `.env` file
2. Restart the server:
   ```powershell
   npm start
   ```

The server should now start without the JWT_SECRET error!
