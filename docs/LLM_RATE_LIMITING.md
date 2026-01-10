# LLM API Rate Limiting

## Overview

This application implements comprehensive rate limiting for all LLM API calls to prevent abuse, protect API keys, and manage costs.

## Configuration

### Environment Variables

Add these to your Vercel environment variables or `.env` file:

```env
# LLM Rate Limiting
LLM_RATE_LIMIT_FREE=3        # Free tier: 3 LLM calls per day
LLM_RATE_LIMIT_PREMIUM=10    # Premium tier: 10 LLM calls per day
```

### Default Values

If not configured, the system uses these defaults:
- **Free Tier**: 3 LLM calls per day
- **Premium Tier**: 10 LLM calls per day

## How It Works

### Rate Limit Tracking

1. **Per-User Tracking**: If user is logged in, tracks by user ID
2. **Per-IP Tracking**: For anonymous users, tracks by IP address
3. **Daily Reset**: Limits reset at midnight UTC
4. **Redis Storage**: Uses Redis for fast, distributed rate limit tracking

### Protected Endpoints

The following endpoints are rate-limited:

| Endpoint | Feature | LLM Provider |
|----------|---------|--------------|
| `POST /api/analyze` | Resume Analysis | Groq/OpenAI |
| `POST /api/mock-interview/generate-interview-questions` | Question Generation | Groq |
| `GET /api/mock-interview/interview-results/:sessionToken` | Feedback Generation | Groq |

### Rate Limit Flow

```
User Request
    ↓
Check Rate Limit (Redis)
    ↓
Limit Exceeded? → Return 429 Error
    ↓
Limit OK? → Process Request
    ↓
LLM API Call
    ↓
Success? → Increment Counter (Redis)
    ↓
Return Response
```

## Error Responses

### Rate Limit Exceeded (429)

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Free limit reached (3/3 LLM calls today). Upgrade to Premium for 10 calls/day.",
  "code": "LLM_RATE_LIMIT_EXCEEDED",
  "limit": 3,
  "remaining": 0,
  "resetAt": "2026-01-10T00:00:00.000Z",
  "upgradeUrl": "/pricing"
}
```

### Response Headers

All LLM API responses include these headers:

```
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 2026-01-10T00:00:00.000Z
```

## Premium Users

To mark a user as premium (future implementation):

```typescript
// In your user database
UPDATE users SET is_premium = true WHERE id = 'user_id';
```

The `checkIfPremium()` function in `llmRateLimiter.ts` will need to be implemented to query your user database.

## Monitoring

### Check Usage Stats

```typescript
import { getLLMUsageStats } from './services/llmRateLimiter';

const stats = await getLLMUsageStats({
  userId: 'user_123',
  ipAddress: '192.168.1.1',
  isPremium: false
});

console.log(stats);
// {
//   used: 2,
//   limit: 3,
//   remaining: 1,
//   resetAt: Date
// }
```

### Redis Keys

Rate limits are stored in Redis with these keys:

```
llm_rate_limit:{userId|ipAddress}:{YYYY-MM-DD}
```

Example:
```
llm_rate_limit:user_123:2026-01-09 → "2"
llm_rate_limit:192.168.1.1:2026-01-09 → "1"
```

Keys automatically expire after 25 hours.

## Testing

### Test Rate Limiting Locally

1. Set low limits for testing:
   ```env
   LLM_RATE_LIMIT_FREE=2
   LLM_RATE_LIMIT_PREMIUM=5
   ```

2. Make multiple requests to `/api/analyze`

3. After 2 requests, you should see 429 error

4. Check Redis:
   ```bash
   redis-cli
   > GET llm_rate_limit:192.168.1.1:2026-01-09
   "2"
   ```

### Bypass Rate Limiting (Development)

To disable rate limiting during development, set:

```env
LLM_RATE_LIMIT_FREE=999
LLM_RATE_LIMIT_PREMIUM=999
```

## Deployment to Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables

2. Add these variables:
   ```
   LLM_RATE_LIMIT_FREE = 3
   LLM_RATE_LIMIT_PREMIUM = 10
   ```

3. Redeploy your application

4. Verify in logs:
   ```
   [Feedback] LLM usage incremented { identifier: '192.168.1.1', count: 1, date: '2026-01-09' }
   ```

## Cost Estimation

### Groq (Free Tier)
- Limit: 14,400 requests/day
- With 3 calls/user/day and 100 users = 300 calls/day
- Well within free tier limits ✅

### OpenAI (Paid Tier)
- Cost: ~$0.01 per analysis
- With 3 calls/user/day and 100 users = 300 calls/day
- Estimated cost: $3/day = $90/month

### Recommended Limits

| User Type | Daily Limit | Monthly Cost (100 users) |
|-----------|-------------|--------------------------|
| Free | 3 | $9/month |
| Premium | 10 | $30/month |

## Troubleshooting

### Issue: Rate limit not working

**Check**:
1. Redis is running: `redis-cli ping` → Should return `PONG`
2. Environment variables are set
3. Middleware is applied to routes
4. Check logs for errors

### Issue: Users hitting limit too quickly

**Solution**:
1. Increase limits in Vercel environment variables
2. Redeploy application
3. Limits update immediately (no code changes needed)

### Issue: Rate limit persists after reset time

**Solution**:
1. Redis keys should auto-expire after 25 hours
2. Manually clear if needed:
   ```bash
   redis-cli
   > DEL llm_rate_limit:192.168.1.1:2026-01-09
   ```

## Future Enhancements

- [ ] Admin dashboard to view usage stats
- [ ] Per-feature limits (different limits for resume vs mock interview)
- [ ] Hourly limits in addition to daily limits
- [ ] Usage analytics and reporting
- [ ] Automatic premium user detection from database
- [ ] Rate limit warnings at 80% usage
