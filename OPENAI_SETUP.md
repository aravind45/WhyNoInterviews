# OpenAI GPT Setup Guide

## Why OpenAI?

Since Claude is experiencing authentication issues, I've added **OpenAI GPT** as a third LLM provider. OpenAI is:
- ✅ Industry standard, very reliable
- ✅ Easy to set up
- ✅ Excellent quality for resume analysis
- ✅ `gpt-4o-mini` is cost-effective (~$0.15 per 1M input tokens)

## Step-by-Step Setup

### 1. Get an OpenAI API Key

**Go to:** https://platform.openai.com/api-keys

**Steps:**
1. Sign in to your OpenAI account (or create one)
2. Click **"Create new secret key"**
3. Give it a name like "WhyNoInterviews"
4. **Copy the key** - it starts with `sk-proj-` or `sk-`
5. Save it somewhere safe (you won't see it again!)

**Key format:**
```
sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Add to Vercel Environment Variables

**Go to:** https://vercel.com/dashboard

**Steps:**
1. Select your **"whynointerviews"** project
2. Click **"Settings"** → **"Environment Variables"**
3. Click **"Add New"**
4. Name: `OPENAI_API_KEY`
5. Value: Paste your OpenAI API key
6. Environment: Select **"Production"**
7. Click **"Save"**

**Optional:** Add model selection (defaults to `gpt-4o-mini`)
- Name: `OPENAI_MODEL`
- Value: `gpt-4o-mini` (cheaper) or `gpt-4o` (better quality)

### 3. Redeploy

**After adding the environment variable:**

1. Go to **"Deployments"** tab
2. Find the latest deployment
3. Click **⋯** → **"Redeploy"**
4. Wait 1-2 minutes

### 4. Test OpenAI

**After deployment completes:**

1. Visit https://whynointerviews.vercel.app
2. Hard refresh (Ctrl+Shift+R)
3. Go to **"Analyze Resume"** tab
4. You should now see **three options** in the dropdown:
   - Groq (Llama)
   - Claude (Anthropic)
   - **GPT-4 (OpenAI)** ← NEW!
5. Select **"GPT-4 (OpenAI)"**
6. Upload resume and analyze

**Expected result:** OpenAI should work perfectly! ✅

## Pricing

OpenAI pricing is very affordable for this use case:

| Model | Input | Output | Cost per Resume |
|-------|-------|--------|-----------------|
| gpt-4o-mini | $0.15/1M tokens | $0.60/1M tokens | ~$0.001 |
| gpt-4o | $2.50/1M tokens | $10.00/1M tokens | ~$0.02 |

**Recommendation:** Start with `gpt-4o-mini` - it's excellent quality and very cheap.

## Why Three LLM Providers?

Now your app supports:

1. **Groq (Llama)** - Fast, free, good quality
2. **Claude (Anthropic)** - Highest quality (when working)
3. **OpenAI GPT** - Reliable industry standard

Users can compare results between different AI models!

## Troubleshooting

### "GPT-4 (OpenAI)" doesn't appear in dropdown

**Possible causes:**
1. Environment variable not set → Add `OPENAI_API_KEY` in Vercel
2. Deployment didn't pick up changes → Force redeploy
3. Browser cache → Hard refresh (Ctrl+Shift+R)

### Error: "OpenAI analysis failed"

**Check:**
1. API key is valid (test at https://platform.openai.com/playground)
2. You have credits in your OpenAI account
3. No rate limits exceeded

### Check Vercel Logs

Look for:
```
✓ OpenAI client initialized successfully
LLM providers initialized: Groq, OpenAI
```

Or when analyzing:
```
Calling OpenAI API with model: gpt-4o-mini
✓ Received response from OpenAI
OpenAI analysis complete - Match: 85%
```

## Advantages Over Claude (Currently)

While Claude has better quality when it works, OpenAI has:
- ✅ More reliable authentication
- ✅ Better error messages
- ✅ Easier to set up
- ✅ Widely used and documented
- ✅ JSON mode for structured responses

Once we fix the Claude authentication issue, you'll have all three providers working!

## Next Steps

1. **Add OpenAI API key** to Vercel
2. **Redeploy** the application
3. **Test** with OpenAI provider
4. **Compare** results between Groq and OpenAI
5. **Fix Claude** (troubleshoot authentication separately)

The app will now work reliably with OpenAI while we figure out what's wrong with the Claude API key!
