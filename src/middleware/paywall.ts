import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware to enforce a paywall on premium routes.
 * Bypassed if:
 * 1. PAYWALL_ENABLED is false
 * 2. Request IP is in PAYWALL_WHITELIST_IPS
 * 3. X-Paywall-Secret header matches PAYWALL_SECRET_KEY
 */
export const paywallMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const isEnabled = process.env.PAYWALL_ENABLED === 'true';

    // Log paywall state on check (useful for debugging, can be removed if too noisy)
    // logger.info(`Paywall check: path=${req.path}, isEnabled=${isEnabled}`);

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
};
