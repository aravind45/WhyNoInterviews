import { Request, Response, NextFunction } from 'express';
import { checkLLMRateLimit, incrementLLMUsage, checkIfPremium } from '../services/llmRateLimiter';
import { logger } from '../utils/logger';

/**
 * Middleware to enforce LLM API rate limits
 * - Checks if user has exceeded daily limit
 * - Returns 429 if limit exceeded
 * - Increments counter on successful requests
 */
export const rateLimitLLM = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get user ID from session or request
        const userId = (req as any).userId || req.body.userId || req.query.userId;

        // Get IP address
        const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '');

        // Check if user is premium
        const isPremium = await checkIfPremium(userId);

        // Check rate limit
        const rateLimitResult = await checkLLMRateLimit({
            userId,
            ipAddress,
            isPremium,
        });

        // Add usage info to response headers
        res.setHeader('X-RateLimit-Limit', rateLimitResult.limit.toString());
        res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
        res.setHeader('X-RateLimit-Reset', rateLimitResult.resetAt.toISOString());

        if (!rateLimitResult.allowed) {
            logger.warn('LLM rate limit exceeded', {
                userId,
                ipAddress,
                isPremium,
                limit: rateLimitResult.limit,
            });

            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: rateLimitResult.message,
                code: 'LLM_RATE_LIMIT_EXCEEDED',
                limit: rateLimitResult.limit,
                remaining: 0,
                resetAt: rateLimitResult.resetAt,
                // Paywall/Upgrade information
                requiresUpgrade: !isPremium,
                upgradeUrl: isPremium ? undefined : '/pricing',
                paywall: {
                    enabled: !isPremium,
                    title: 'Upgrade to Premium',
                    message: `You've used all ${rateLimitResult.limit} free LLM calls today. Upgrade to Premium for ${process.env.LLM_RATE_LIMIT_PREMIUM || '10'} calls per day.`,
                    features: [
                        `${process.env.LLM_RATE_LIMIT_PREMIUM || '10'} LLM calls per day (vs ${rateLimitResult.limit} free)`,
                        'Priority support',
                        'Advanced analytics',
                        'Early access to new features'
                    ],
                    pricing: {
                        monthly: '$9.99/month',
                        annual: '$99/year (save 17%)'
                    },
                    ctaText: 'Upgrade Now',
                    ctaUrl: '/pricing'
                }
            });
        }

        // Attach increment function to request for use after successful LLM call
        (req as any).incrementLLMUsage = () => incrementLLMUsage({ userId, ipAddress, isPremium });

        next();
    } catch (error) {
        logger.error('Rate limit middleware error:', error);
        // Fail open - allow request if middleware fails
        next();
    }
};

/**
 * Helper to increment usage after successful LLM call
 * Call this AFTER the LLM API call succeeds
 */
export const incrementLLMUsageFromRequest = async (req: Request) => {
    try {
        if ((req as any).incrementLLMUsage) {
            await (req as any).incrementLLMUsage();
        }
    } catch (error) {
        logger.error('Failed to increment LLM usage:', error);
    }
};
