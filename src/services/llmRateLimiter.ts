import { cacheGet, cacheSet } from '../cache/redis';
import { logger } from '../utils/logger';

/**
 * Simple LLM Rate Limiter
 * - Free tier: 3 LLM calls per day (configurable via env)
 * - Premium tier: 10 LLM calls per day (configurable via env)
 * - Tracks usage per user/IP per day
 */

interface RateLimitConfig {
    userId?: string;
    ipAddress: string;
    isPremium?: boolean;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    limit: number;
    resetAt: Date;
    message?: string;
}

// Get limits from environment variables with defaults
const FREE_TIER_DAILY_LIMIT = parseInt(process.env.LLM_RATE_LIMIT_FREE || '3');
const PREMIUM_TIER_DAILY_LIMIT = parseInt(process.env.LLM_RATE_LIMIT_PREMIUM || '10');

/**
 * Check if LLM API call is allowed
 */
export async function checkLLMRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    try {
        const { userId, ipAddress, isPremium = false } = config;

        // Determine the limit based on user tier
        const dailyLimit = isPremium ? PREMIUM_TIER_DAILY_LIMIT : FREE_TIER_DAILY_LIMIT;

        // Create a unique key for this user/IP for today
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const identifier = userId || ipAddress;
        const cacheKey = `llm_rate_limit:${identifier}:${today}`;

        // Get current usage count
        const currentCount = parseInt((await cacheGet(cacheKey)) || '0');

        // Calculate reset time (midnight UTC)
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);

        // Check if limit exceeded
        if (currentCount >= dailyLimit) {
            logger.warn(`LLM rate limit exceeded`, {
                identifier,
                currentCount,
                dailyLimit,
                isPremium,
            });

            return {
                allowed: false,
                remaining: 0,
                limit: dailyLimit,
                resetAt: tomorrow,
                message: isPremium
                    ? `Premium limit reached (${dailyLimit}/${dailyLimit} LLM calls today). Resets at midnight UTC.`
                    : `Free limit reached (${dailyLimit}/${dailyLimit} LLM calls today). Upgrade to Premium for ${PREMIUM_TIER_DAILY_LIMIT} calls/day.`,
            };
        }

        return {
            allowed: true,
            remaining: dailyLimit - currentCount,
            limit: dailyLimit,
            resetAt: tomorrow,
        };
    } catch (error) {
        logger.error('Rate limit check failed:', error);
        // Fail open - allow request if rate limit check fails
        return {
            allowed: true,
            remaining: 999,
            limit: 999,
            resetAt: new Date(),
        };
    }
}

/**
 * Increment LLM usage counter
 */
export async function incrementLLMUsage(config: RateLimitConfig): Promise<void> {
    try {
        const { userId, ipAddress } = config;

        const today = new Date().toISOString().split('T')[0];
        const identifier = userId || ipAddress;
        const cacheKey = `llm_rate_limit:${identifier}:${today}`;

        // Get current count
        const currentCount = parseInt((await cacheGet(cacheKey)) || '0');
        const newCount = currentCount + 1;

        // Set with 25-hour expiry (to cover timezone differences)
        await cacheSet(cacheKey, newCount.toString(), 25 * 60 * 60);

        logger.info(`LLM usage incremented`, {
            identifier,
            count: newCount,
            date: today,
        });
    } catch (error) {
        logger.error('Failed to increment LLM usage:', error);
        // Don't throw - this is non-critical
    }
}

/**
 * Get current usage stats for a user/IP
 */
export async function getLLMUsageStats(config: RateLimitConfig): Promise<{
    used: number;
    limit: number;
    remaining: number;
    resetAt: Date;
}> {
    try {
        const { userId, ipAddress, isPremium = false } = config;

        const dailyLimit = isPremium ? PREMIUM_TIER_DAILY_LIMIT : FREE_TIER_DAILY_LIMIT;
        const today = new Date().toISOString().split('T')[0];
        const identifier = userId || ipAddress;
        const cacheKey = `llm_rate_limit:${identifier}:${today}`;

        const currentCount = parseInt((await cacheGet(cacheKey)) || '0');

        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);

        return {
            used: currentCount,
            limit: dailyLimit,
            remaining: Math.max(0, dailyLimit - currentCount),
            resetAt: tomorrow,
        };
    } catch (error) {
        logger.error('Failed to get usage stats:', error);
        return {
            used: 0,
            limit: 999,
            remaining: 999,
            resetAt: new Date(),
        };
    }
}

/**
 * Check if user is premium (placeholder - implement based on your user system)
 */
export async function checkIfPremium(userId?: string): Promise<boolean> {
    if (!userId) return false;

    // TODO: Implement actual premium check from database
    // For now, return false (all users are free tier)
    // Example:
    // const result = await query('SELECT is_premium FROM users WHERE id = $1', [userId]);
    // return result.rows[0]?.is_premium || false;

    return false;
}
