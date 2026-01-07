# Fix Claude API Key - Step by Step

## The Issue

The error `invalid x-api-key` means the API key stored in Vercel is not valid.

The SDK is now working correctly (the import fix worked!), but the actual API key needs to be regenerated.

## Step-by-Step Fix

### 1. Get a Fresh API Key from Anthropic

**Go to:** https://console.anthropic.com/settings/keys

**Steps:**

1. Log in to your Anthropic account
2. Click on **"Settings"** → **"API Keys"**
3. **Delete the old key** (if you see one listed)
4. Click **"Create Key"** button
5. Give it a name like "WhyNoInterviews Production"
6. **IMPORTANT:** Copy the ENTIRE key immediately - it shows only once!

**The key should look like:**

```
sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Characteristics of a valid key:**

- Starts with `sk-ant-api03-`
- Followed by ~95-100 more characters (letters, numbers, hyphens, underscores)
- Total length: ~105-110 characters
- No spaces, no line breaks, no quotes

### 2. Update Vercel Environment Variable

**Go to:** https://vercel.com/dashboard

**Steps:**

1. Find your **"whynointerviews"** project
2. Click **"Settings"** tab (top navigation)
3. Click **"Environment Variables"** (left sidebar)
4. Find **`ANTHROPIC_API_KEY`** in the list
5. Click the **⋯** (three dots) → **"Edit"**
6. **Paste the new key** (the ENTIRE key from step 1)
7. **DO NOT add quotes around it** - just paste the raw key
8. Make sure it's set for **"Production"** environment
9. Click **"Save"**

### 3. Redeploy

**After saving the environment variable:**

**Option A - Automatic (if auto-deploy is enabled):**

1. The app should automatically redeploy within 1-2 minutes
2. Watch the "Deployments" tab for the new build

**Option B - Manual redeploy:**

1. Go to **"Deployments"** tab
2. Find the latest deployment
3. Click **⋯** (three dots) → **"Redeploy"**
4. Confirm the redeploy

### 4. Test After Deployment

**Wait for deployment to complete** (1-2 minutes)

**Then test:**

1. Visit https://whynointerviews.vercel.app
2. **Hard refresh** (Ctrl+Shift+R or Cmd+Shift+R)
3. Go to "Analyze Resume" tab
4. Select **"Claude (Anthropic)"** from dropdown
5. Upload resume + paste job description
6. Click **"Analyze My Match"**

**Expected:** Claude analysis completes successfully!

## Common Issues

### Issue 1: "I don't see the API key in Anthropic Console"

**Solution:**

- You might not have created one yet
- Click "Create Key" to generate a new one
- If you had one before, it might have been deleted or expired

### Issue 2: "I copied the key but it still shows invalid"

**Possible causes:**

1. **Extra spaces** - Check there are no spaces before/after the key
2. **Quotes** - Remove any quotes (`"` or `'`) around the key
3. **Incomplete copy** - The key is very long, make sure you copied ALL of it
4. **Wrong key** - Make sure you copied from "API Keys" not "Workspace ID" or other fields

**How to verify your copy:**

```bash
# The key should be ~105-110 characters
# Count characters (should be around 105-110):
echo "sk-ant-api03-your-full-key-here" | wc -c

# Should start with:
sk-ant-api03-

# Should NOT contain:
- Spaces
- Line breaks
- Quotes (" or ')
- Special characters except - and _
```

### Issue 3: "Vercel won't save the environment variable"

**Solution:**

1. Try a different browser
2. Clear browser cache
3. Try editing via Vercel CLI:
   ```bash
   vercel env add ANTHROPIC_API_KEY
   # Paste the key when prompted
   # Select "Production"
   ```

### Issue 4: "I updated the key but it's still using the old one"

**Solution:**

- You MUST redeploy after changing environment variables
- Environment variables only take effect on new deployments
- Force a redeploy from the Deployments tab

## Verification Checklist

Before testing, verify:

- [ ] New API key created in Anthropic Console
- [ ] Key is ~105-110 characters long
- [ ] Key starts with `sk-ant-api03-`
- [ ] No spaces or quotes in Vercel environment variable
- [ ] Environment variable set for "Production"
- [ ] Vercel deployment completed successfully
- [ ] Hard refresh of the web app

## Still Not Working?

If you still get `invalid x-api-key` after following all steps:

### Check Your Anthropic Account:

1. **Billing:** https://console.anthropic.com/settings/billing
   - Verify you have a payment method added
   - Check if you have available credits
   - Ensure no payment failures

2. **API Key Permissions:**
   - Some accounts have restricted API access
   - Verify your account type allows API usage
   - Check if there are any usage restrictions

3. **Rate Limits:**
   - Check if you've exceeded rate limits
   - Try again in a few minutes

### Test the Key Directly:

```bash
# Replace YOUR_API_KEY with your actual key
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

**If this returns 401:** The API key is definitely invalid, regenerate it in Anthropic Console

**If this returns 200:** The API key works! The issue is with how it's stored in Vercel

## Need More Help?

If you've tried everything and it still doesn't work, share:

1. Screenshot of Anthropic Console showing the API key created (blur the actual key!)
2. Screenshot of Vercel environment variables showing ANTHROPIC_API_KEY exists
3. First 20 characters of your API key (e.g., `sk-ant-api03-abcd1...`)
4. Any error messages from the curl test above
