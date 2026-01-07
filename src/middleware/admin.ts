import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Default admin emails if env var is missing
const DEFAULT_ADMINS = ['aravind45@gmail.com'];

export const checkAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get session ID from header, body, or query
    const sessionId = req.headers['x-session-id'] || req.body.sessionId || req.query.sessionId;

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No session ID' });
    }

    // Lookup user email from session
    const { query } = await import('../database/connection'); // Lazy load to avoid circular dep

    if (!query) {
      const msg = 'CRITICAL: query function is undefined in admin middleware';
      logger.error(msg);
      throw new Error(msg);
    }

    const result = await query(`SELECT email FROM user_sessions WHERE session_id = $1`, [
      sessionId,
    ]);

    if (result.rows.length === 0 || !result.rows[0].email) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid session' });
    }

    const userEmail = result.rows[0].email;

    // Get allowed admins
    const allowedAdmins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    // Combine with defaults
    const allAdmins = [...new Set([...DEFAULT_ADMINS, ...allowedAdmins])];

    if (!allAdmins.includes(userEmail)) {
      logger.warn(`Admin access denied for ${userEmail}`);
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access only' });
    }

    // Attach admin info to request
    (req as any).user = { email: userEmail, isAdmin: true };
    (req as any).isAdmin = true;

    next();
  } catch (error: any) {
    const errMsg = `Admin Check Error: ${error.message}\nStack: ${error.stack}\n`;
    logger.error(errMsg);
    try {
      require('fs').appendFileSync(
        'admin_error.log',
        new Date().toISOString() + ' ' + errMsg + '\n',
      );
    } catch (e) {
      console.error('Failed to write log', e);
    }

    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};
