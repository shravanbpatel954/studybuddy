# Fix Missing Packages Error

## The Problem
The error `Cannot find module 'express-timeout-handler'` occurs because the packages added during security fixes weren't installed.

## Quick Fix

### Option 1: Run the Script (Easiest)

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File install-missing-packages.ps1
```

### Option 2: Manual Installation

Run this command in your PowerShell terminal:

```powershell
cd backend
npm install express-timeout-handler express-rate-limit validator --save
```

### Option 3: Full Reinstall

If the above doesn't work, try:

```powershell
cd backend
npm install
```

This will install all packages listed in `package.json`, including the new ones.

## After Installation

Start your server:

```powershell
npm start
```

The server should now start without the module error!

---

## What Happened?

During the security audit and fixes, we added these packages to the code:
- `express-timeout-handler` - For request timeout handling
- `express-rate-limit` - For rate limiting (security)
- `validator` - For input validation (security)

These packages were added to `package.json` but need to be installed with `npm install`.

---

## Verify Installation

Check if packages are installed:

```powershell
cd backend
npm list express-timeout-handler express-rate-limit validator
```

You should see all three packages listed.
