import { Request, Response, NextFunction } from 'express';
import { getPool } from '../database/connection';

// Free IP geolocation service (no API key required)
// For production, consider using a paid service like MaxMind, IPStack, or IP2Location
async function getCountryFromIP(ip: string): Promise<{ country: string; city: string } | null> {
    try {
        // Skip for localhost/private IPs
        if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
            return { country: 'Local', city: 'Local' };
        }

        // Use ip-api.com (free, no key required, 45 requests/minute limit)
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
        const data = await response.json();

        if (data.status === 'success') {
            return {
                country: data.country || 'Unknown',
                city: data.city || 'Unknown',
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching geolocation:', error);
        return null;
    }
}

// Extract real IP address from request (handles proxies, load balancers)
function getClientIP(req: Request): string {
    // Check various headers in order of preference
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // x-forwarded-for can contain multiple IPs, take the first one
        const ips = (forwarded as string).split(',');
        return ips[0].trim();
    }

    const realIP = req.headers['x-real-ip'];
    if (realIP) {
        return realIP as string;
    }

    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    if (cfConnectingIP) {
        return cfConnectingIP as string;
    }

    // Fallback to socket address
    return req.socket.remoteAddress || req.ip || 'Unknown';
}

// Middleware to track IP and country
export async function trackIPMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const ip = getClientIP(req);
        const userAgent = req.headers['user-agent'] || 'Unknown';

        // Attach to request for use in other middleware/routes
        (req as any).clientIP = ip;
        (req as any).userAgent = userAgent;

        // Get geolocation data (async, don't block the request)
        getCountryFromIP(ip).then(async (location) => {
            const country = location?.country || 'Unknown';
            const city = location?.city || 'Unknown';

            (req as any).clientCountry = country;
            (req as any).clientCity = city;

            // Log session if user is authenticated
            const userId = req.headers['x-user-id'] as string;
            const sessionId = req.headers['x-session-id'] as string ||
                req.cookies?.sessionId ||
                (req as any).sessionId;

            if (userId || sessionId) {
                try {
                    const pool = getPool();
                    await pool.query(
                        `INSERT INTO user_sessions_log (user_id, session_id, ip_address, country, city, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
                        [userId || null, sessionId, ip, country, city, userAgent]
                    );

                    // Update user's last login info if user is authenticated
                    if (userId) {
                        await pool.query(
                            `UPDATE users 
               SET last_ip_address = $1, 
                   last_country = $2, 
                   last_login_at = NOW()
               WHERE id = $3`,
                            [ip, country, userId]
                        );

                        // Set initial IP/country if not set
                        await pool.query(
                            `UPDATE users 
               SET ip_address = $1, 
                   country = $2
               WHERE id = $3 AND ip_address IS NULL`,
                            [ip, country, userId]
                        );
                    }
                } catch (error) {
                    console.error('Error logging session:', error);
                    // Don't fail the request if logging fails
                }
            }
        }).catch(err => {
            console.error('Error in IP tracking:', err);
            // Don't block the request
        });

        next();
    } catch (error) {
        console.error('Error in trackIPMiddleware:', error);
        next(); // Continue even if tracking fails
    }
}

// Helper function to get IP info for a request (synchronous)
export function getIPInfo(req: Request): { ip: string; country?: string; city?: string; userAgent: string } {
    return {
        ip: (req as any).clientIP || getClientIP(req),
        country: (req as any).clientCountry,
        city: (req as any).clientCity,
        userAgent: (req as any).userAgent || req.headers['user-agent'] || 'Unknown',
    };
}

export { getClientIP, getCountryFromIP };
