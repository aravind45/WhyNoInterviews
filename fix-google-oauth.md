# Fix Google OAuth Login Issue

## Problem

Google Sign-In shows "Access blocked: This app's request is invalid" with redirect_uri_mismatch error.

## Root Cause

The hardcoded Google Client ID in the code is not configured for localhost:3000 domain.

## Quick Fix Options

### Option 1: Disable Google Sign-In (Fastest)

Comment out Google Sign-In buttons to use only email/password login:

```javascript
// In src/public/index.html, comment out these lines:
// <button type="button" class="btn btn-google btn-full" onclick="signInWithGoogle()">
//   Continue with Google
// </button>
```

### Option 2: Configure Google OAuth (Proper Fix)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized origins:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
6. Add authorized redirect URIs:
   - `http://localhost:3000`
   - `http://localhost:3000/auth/google/callback`
7. Copy the Client ID and replace in the code

### Option 3: Use Environment Variable (Best Practice)

1. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-new-client-id-here
   ```
2. Update the code to use environment variable instead of hardcoded value

## Immediate Workaround

The email/password login should still work fine. Only Google Sign-In is affected.

## Test Regular Login

Try logging in with:

- Email: test@example.com
- Password: password123

Or create a new account with the signup form.
