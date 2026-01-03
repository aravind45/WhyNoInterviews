import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { cacheGet } from '../cache/redis';

/**
 * Middleware to enforce a paywall on premium routes.
 * Checks Redis config first, then falls back to ENV.
 */
export const paywallMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1. Check dynamic config from Redis
        const dynamicState = await cacheGet<string>('config:paywall_enabled');

        // 2. Determine enabled state:
        // - If Redis has value 'true'/'false', use it.
        // - Otherwise fallback to ENV.
        let isEnabled: boolean;

        if (dynamicState !== null) {
            isEnabled = dynamicState === 'true';
        } else {
            isEnabled = process.env.PAYWALL_ENABLED === 'true';
        }

        // logger.info(`Paywall check: path=${req.path}, isEnabled=${isEnabled} (source=${dynamicState !== null ? 'redis' : 'env'})`);

        if (!isEnabled) {
            return next();
        }

        const whitelistIps = (process.env.PAYWALL_WHITELIST_IPS || '').split(',').map(ip => ip.trim());
        const secretKey = process.env.PAYWALL_SECRET_KEY;
        const clientIp = req.ip || req.socket.remoteAddress || '';
        const clientSecret = req.header('X-Paywall-Secret');

        // Check IP whitelist
        if (whitelistIps.includes(clientIp)) {
            logger.info(`Paywall bypassed by whitelisted IP: ${clientIp}`);
            return next();
        }

        // Check secret key header
        if (secretKey && clientSecret === secretKey) {
            logger.info(`Paywall bypassed by secret key from IP: ${clientIp}`);
            return next();
        }

        // Paywall active and no bypass
        logger.warn(`Paywall blocked access from IP: ${clientIp} for path: ${req.path}`);

        return res.status(402).json({
            success: false,
            error: 'Payment Required',
            message: 'This feature is currently locked. Please contact the administrator for access or stay tuned for the public release.',
            code: 'PAYWALL_REQUIRED'
        });
    } catch (error) {
        logger.error('Paywall middleware error:', error);
        // Fail open or closed? Safer to fail closed if error, but here we'll fail open for UX if cache fails
        return next();
    }
};
