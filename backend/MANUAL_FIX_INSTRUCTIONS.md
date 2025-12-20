# Manual Fix for JWT_SECRET Error

## The Problem
After implementing security fixes, the server now requires `JWT_SECRET` and `SESSION_SECRET` in your `.env` file.

## Quick Solution

### Step 1: Open your `.env` file
Navigate to: `backend/.env`

### Step 2: Add these two lines at the end of the file:

```env
JWT_SECRET=your-secret-key-here-minimum-32-characters-long
SESSION_SECRET=your-session-secret-here-minimum-32-characters-long
```

### Step 3: Generate secure secrets

Run this command in PowerShell:

```powershell
cd backend
node -e "const crypto = require('crypto'); console.log('JWT_SECRET=' + crypto.randomBytes(32).toString('hex')); console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('hex'));"
```

**Copy the output** and paste it into your `.env` file, replacing the placeholder values.

### Step 4: Save the file and restart

```powershell
npm start
```

## Alternative: Use the Script

I've created a script that does this automatically:

```powershell
cd backend
node fix-env.js
```

Then start your server:

```powershell
npm start
```

## Temporary Development Mode

The server should now start in development mode with a warning if secrets are missing. However, **you should still add the secrets** for proper security.

---

**Note:** The server was working before because it had a hardcoded secret. Now it's more secure but requires you to set the secrets in `.env`.
