# Password Reset & CORS Issue - Solution Guide

## Issues Fixed ✅

### 1. **500 Internal Server Error on `/api/v1/auth/forgot`**
**Root Cause:** The `sendResetEmail()` function was throwing errors (missing SMTP credentials) without proper error handling, causing the entire request to fail with 500.

**Solution:**
- ✅ Added environment variable validation in `nodemailer.js`
- ✅ Added SMTP connection verification
- ✅ Added detailed logging for debugging
- ✅ Added try-catch blocks with informative error messages
- ✅ Made ForgotPassword controller handle email service failures gracefully

### 2. **CORS Policy Blocking Requests**
**Root Cause:** 
- CORS configuration was using wildcard (`*`) but Render.com's cross-origin requests need explicit origin whitelisting
- Missing `optionsSuccessStatus` for pre-flight requests

**Solution:**
- ✅ Enhanced CORS configuration with explicit origin whitelist
- ✅ Added dynamic origin checking function
- ✅ Added CORS logging for debugging
- ✅ Included all known Render.com deployment URLs
- ✅ Added support for environment variable-based origins

---

## Files Modified

### 1. `backend/src/utils/nodemailer.js`
**Changes:**
- Added environment variable validation (SMTP_USER, SMTP_PASS)
- Added SMTP connection verification with `.verify()`
- Added timeout configuration (5s)
- Added comprehensive logging with emojis for easy identification
- Added try-catch for email sending with detailed error logging
- Development mode: logs email instead of sending if credentials missing

### 2. `backend/src/controller/AuthController.js`
**Changes:**
- Updated `ForgotPassword` controller
- Wrapped email sending in try-catch
- Added logging for password reset attempts
- Made controller resilient to email service failures
- Token is still saved even if email fails to send

### 3. `backend/src/app.js`
**Changes:**
- Replaced simple CORS with sophisticated origin whitelist
- Added dynamic origin validation function
- Added CORS activity logging
- Included production Render.com URLs
- Added support for environment variables (FRONTEND_URL, ALLOWED_ORIGINS)

### 4. `backend/.env.example` (NEW)
**Purpose:** Complete environment variable template for developers

---

## Environment Variables Required

### For Email to Work (CRITICAL):

```env
# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # Gmail App Password, NOT regular password
SMTP_FROM=noreply@studybuddy.com
FRONTEND_URL=https://studybuddy-kc2m.onrender.com
```

**⚠️ Important for Gmail:**
1. Enable 2-Factor Authentication
2. Go to: https://myaccount.google.com/apppasswords
3. Generate App Password for Gmail
4. Use that 16-character password in `SMTP_PASS`

### For CORS to Work (CRITICAL for Production):

```env
NODE_ENV=production
FRONTEND_URL=https://studybuddy-kc2m.onrender.com
ALLOWED_ORIGINS=https://studybuddy-kc2m.onrender.com,https://other-domain.com
```

---

## Testing the Fix

### 1. **Test Email Sending (Development)**
```bash
# Check console output
# Should see:
# ✅ SMTP connection verified
# 📧 Sending reset email to: user@example.com
# ✅ Email sent successfully. Message ID: ...
```

### 2. **Test CORS**
```bash
# Browser console should show:
# [CORS] POST /api/v1/auth/forgot - Origin: https://studybuddy-kc2m.onrender.com
# ✅ Success (no CORS errors)

# If it fails:
# ⚠️ CORS blocked origin: https://some-url.com
```

### 3. **Test Full Flow**
1. Go to Login page
2. Click "Forgot Password?"
3. Enter email
4. Should see: "If that email exists, a reset link has been sent"
5. Check email for reset link (or check console logs in development)

---

## Debugging

### If you still get 500 errors:

1. **Check environment variables:**
```bash
# Backend logs should show:
# ✅ SMTP connection verified

# If not, you'll see:
# ⚠️ Email credentials not configured
```

2. **Check CORS errors:**
```bash
# Browser console error example:
# Access to fetch at '...' from origin '...' has been blocked by CORS policy

# Backend logs should show:
# ⚠️ CORS blocked origin: https://wrong-url.com
# Compare with ALLOWED_ORIGINS in .env
```

3. **Enable detailed logging:**
Set `NODE_ENV=development` to get full logging

4. **Check Gmail app password:**
- Is 2FA enabled? (required for app passwords)
- Did you generate an App Password? (not regular password)
- Is the 16-char password correct?

---

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `SMTP_*` variables with Gmail App Password
- [ ] Set `FRONTEND_URL` to your production frontend URL
- [ ] Set `ALLOWED_ORIGINS` to include all frontend domains
- [ ] Verify `JWT_SECRET` is secure and unique
- [ ] Enable all required APIs (Google OAuth, Gemini, etc.)
- [ ] Test password reset flow end-to-end
- [ ] Check server logs for CORS warnings
- [ ] Verify email arrives in user's inbox (check spam folder)

---

## Error Messages You Might See

### ✅ Success Cases:
```
✅ SMTP connection verified
📧 Sending reset email to: user@email.com
✅ Email sent successfully. Message ID: <...>
```

### ⚠️ Warnings (Development):
```
⚠️ Email credentials not configured
📧 Development mode: Email sending skipped
```

### ❌ Errors:
```
❌ Error sending reset email: SMTP authentication failed
❌ Error sending reset email: connect ETIMEDOUT
⚠️ CORS blocked origin: https://wrong-url.com
```

---

## Next Steps

1. **Configure `.env` file:**
   - Copy content from `.env.example`
   - Add your SMTP credentials
   - Set FRONTEND_URL and ALLOWED_ORIGINS

2. **Test locally:**
   ```bash
   npm start
   # Try password reset
   # Check console for logs
   ```

3. **Deploy to Render.com:**
   - Add all env variables in Render dashboard
   - Redeploy backend
   - Test from production URL

4. **Monitor:**
   - Watch logs for CORS warnings
   - Verify emails are being sent
   - Check user feedback on password reset

---

## Quick Reference

| Issue | Solution |
|-------|----------|
| 500 error on forgot password | Check SMTP env vars configured |
| CORS blocked on production | Add domain to ALLOWED_ORIGINS |
| Email not received | Check Gmail app password is correct |
| Email received but no link | Check FRONTEND_URL is correct |
| Pre-flight requests failing | CORS now handles OPTIONS automatically |

