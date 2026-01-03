import { Request, Response, NextFunction } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

/**
 * Middleware to enforce lifetime rate limit for Deep Analysis
 * Limit: 3 analyses TOTAL per session
 */
export const checkLifetimeLimit = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.body.sessionId || req.query.sessionId || req.headers['x-session-id'];

        // If no session, likely an initial request that will fail later, or dev testing
        // Let specific route handlers check for session existence if needed.
        // However, for rate limiting, if no session, we can't count.
        // If strict mode, block. But mostly we rely on body sessionId.
        if (!sessionId) {
            // Pass through - validation will happen in controller
            return next();
        }

        // Bypass for Paid Users (future proofing - relying on 'is_pro' flag in user_sessions if it existed)
        // For now, we just count analyses.

        // Count valid analyses for this IP address across ALL sessions
        const clientIp = req.ip || req.socket.remoteAddress;

        const result = await query(
            `SELECT COUNT(*) as count 
       FROM resume_analyses ra
       JOIN user_sessions us ON ra.session_id = us.id
       WHERE us.ip_address = $1
       AND ra.status != 'failed' 
       AND ra.status != 'deleted'`,
            [clientIp]
        );

        const count = parseInt(result.rows[0]?.count || '0');
        const LIMIT = 3;

        if (count >= LIMIT) {
            logger.warn(`Rate limit exceeded for IP ${clientIp}. Count: ${count}`);
            return res.status(403).json({
                success: false,
                error: 'Free limit reached (3/3 analyses). Please upgrade to Pro for unlimited access.',
                code: 'RATE_LIMIT_EXCEEDED',
                isUpgradeRequired: true
            });
        }

        // Attach usage info to request for logging
        (req as any).usageCount = count;

        next();
    } catch (error) {
        logger.error('Rate limit check failed:', error);
        // Fail open (allow request) if DB check fails, to prevent blocking valid users during outages?
        // Or fail closed. Fail open is usually safer for UX unless abuse is rampant.
        next();
    }
};
