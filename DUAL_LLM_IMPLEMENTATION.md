# Dual-LLM Implementation Summary

## Overview

Added support for multiple LLM providers (Groq and Claude) with user-selectable option in the resume analysis interface.

## Implementation Date

December 28, 2025

## Features Added

### 1. Backend Services

#### New Files Created:

- `src/services/claude.ts` - Claude AI service (parallel to Groq)
- `src/services/llmProvider.ts` - LLM provider factory and management
- `src/database/migrations/001_add_llm_provider.sql` - Database schema migration

#### Service Architecture:

- **Common Interface**: Both Groq and Claude services implement the same interface
- **Factory Pattern**: `llmProvider.ts` provides unified access to all providers
- **Graceful Degradation**: System works with either provider or both configured
- **Identical Response Format**: Both providers return the same JSON structure

### 2. Database Changes

#### New Columns:

```sql
-- resume_analyses table
ALTER TABLE resume_analyses
ADD COLUMN llm_provider VARCHAR(50) DEFAULT 'groq'
CHECK (llm_provider IN ('groq', 'claude'));

-- diagnosis_results table
ALTER TABLE diagnosis_results
ADD COLUMN llm_provider VARCHAR(50) DEFAULT 'groq'
CHECK (llm_provider IN ('groq', 'claude'));
```

#### Indexes Added:

- `idx_resume_analyses_llm_provider`
- `idx_diagnosis_results_llm_provider`

### 3. API Updates

#### New Endpoint:

```typescript
GET / api / llm - providers;
// Returns list of available providers and default selection
```

#### Updated Endpoints:

- `POST /api/upload` - Now accepts `llmProvider` parameter
- `POST /api/analyze` - Now accepts `llmProvider` parameter

### 4. Frontend Changes

#### UI Components:

- **LLM Provider Dropdown**: Added to analyze resume form
- **Provider Display**: Shows which LLM analyzed the resume in results
- **Dynamic Loading**: Dropdown populated from `/api/llm-providers` endpoint

#### JavaScript Updates:

- `loadLLMProviders()` - Fetches and populates provider dropdown
- Updated analyze button handler to include selected provider in form data
- Display logic to show provider name in analysis results

### 5. Configuration

#### Environment Variables:

```env
# At least one required
GROQ_API_KEY=your_groq_api_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional model selection
GROQ_MODEL=llama-3.1-8b-instant
CLAUDE_MODEL=claude-sonnet-4-5-20250929
```

## Provider Comparison

### Groq (Llama 3.1 8B Instant)

- **Speed**: ~2-3 seconds for analysis
- **Cost**: Free tier available, very cost-effective
- **Quality**: Good for most use cases
- **Best For**: Quick iterations, testing, high-volume processing

### Claude (Sonnet 4.5)

- **Speed**: ~5-10 seconds for analysis
- **Cost**: Pay-per-use (more expensive than Groq)
- **Quality**: Superior analysis, better nuance detection
- **Best For**: Final analysis, detailed feedback, catching subtle issues

## Technical Details

### Provider Service Interface:

```typescript
interface LLMProviderService {
  name: LLMProvider;
  displayName: string;
  isAvailable: () => boolean;
  analyzeResume: (resumeData, targetJob, jobDescription?) => Promise<LLMAnalysisResult>;
}
```

### Initialization Flow:

1. `initializeProviders()` called on server startup
2. Initializes both Groq and Claude clients (if API keys present)
3. Logs which providers are available

### Request Flow:

1. User selects provider from dropdown (or uses default)
2. Provider selection sent with resume upload
3. Backend validates provider availability
4. Selected provider's `analyzeResume()` method called
5. Results stored in DB with provider information
6. Response includes `llmProvider` and `modelUsed` fields

## Migration Steps

### For Existing Deployments:

1. **Install Dependencies**:

```bash
npm install @anthropic-ai/sdk
```

2. **Run Database Migration**:

```bash
psql $DATABASE_URL -f src/database/migrations/001_add_llm_provider.sql
```

3. **Update Environment Variables**:

```bash
# Add to .env
ANTHROPIC_API_KEY=your_key_here
CLAUDE_MODEL=claude-sonnet-4-5-20250929  # Optional
```

4. **Restart Server**:

```bash
npm run build
npm start
```

## Backwards Compatibility

- ✅ Existing code continues to work with Groq only
- ✅ If no provider specified, defaults to first available (typically Groq)
- ✅ Database defaults to 'groq' for `llm_provider` column
- ✅ Frontend gracefully handles missing provider information

## Testing Recommendations

1. **Test with Groq only** (existing behavior)
2. **Test with Claude only** (new provider)
3. **Test with both configured** (user selection)
4. **Test with neither configured** (error handling)
5. **Compare analysis results** between providers for same resume

## Future Enhancements

### Potential Additions:

- [ ] OpenAI GPT-4/GPT-4o support
- [ ] Gemini support
- [ ] Side-by-side comparison mode (run both simultaneously)
- [ ] Provider-specific cost tracking
- [ ] Response time metrics per provider
- [ ] A/B testing framework for provider quality

## Files Modified

### Backend:

- `src/services/claude.ts` (**NEW**)
- `src/services/llmProvider.ts` (**NEW**)
- `src/database/migrations/001_add_llm_provider.sql` (**NEW**)
- `src/routes/api.ts` (MODIFIED - added provider handling)
- `src/types/index.ts` (MODIFIED - added llmProvider to schemas)
- `src/index.ts` (MODIFIED - added initializeProviders())
- `package.json` (MODIFIED - added @anthropic-ai/sdk)

### Frontend:

- `src/public/index.html` (MODIFIED - added dropdown and display logic)

### Documentation:

- `README.md` (MODIFIED - documented dual-LLM feature)
- `DUAL_LLM_IMPLEMENTATION.md` (**NEW** - this file)

## API Response Format

### Before:

```json
{
  "success": true,
  "data": {
    "overallScore": 75,
    "aiOriginalScore": 85,
    "summary": "..."
    // ... other fields
  }
}
```

### After:

```json
{
  "success": true,
  "data": {
    "overallScore": 75,
    "aiOriginalScore": 85,
    "llmProvider": "claude",
    "modelUsed": "claude-sonnet-4-5-20250929",
    "summary": "..."
    // ... other fields
  }
}
```

## Security Considerations

- API keys stored in environment variables only
- Resume data anonymized before sending to LLMs (PII removed)
- Same security standards for both providers
- Provider selection validated on backend
- No provider-specific data exposed to frontend beyond name

## Cost Optimization Tips

1. Use Groq for initial iterations and testing
2. Switch to Claude for final/critical analyses
3. Cache results in database (7-day TTL) to avoid re-analysis
4. Monitor API usage per provider
5. Consider implementing rate limiting per provider

## Support & Maintenance

### Getting API Keys:

**Groq:**

- Sign up at: https://console.groq.com
- Free tier: ~30 requests/minute
- Model: llama-3.1-8b-instant

**Anthropic (Claude):**

- Sign up at: https://console.anthropic.com
- Pay-per-use pricing
- Model: claude-sonnet-4-5-20250929

### Troubleshooting:

**Provider not showing in dropdown:**

- Check API key is set correctly
- Verify `initializeProviders()` is called on startup
- Check server logs for initialization errors

**Analysis fails with specific provider:**

- Verify API key is valid
- Check API rate limits
- Review server logs for detailed error messages
- Ensure model name is correct in environment variables

---

**Implementation completed successfully!** ✅
