
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface AuthRequest extends Request {
    body: {
        email?: string;
        password?: string;
        credential?: string; // Google ID Token
        fullName?: string;
        sessionId?: string; // Current guest session to link
    };
}

// Helper to link session to user
async function linkSessionToUser(sessionId: string, userId: string) {
    if (!sessionId) return;
    try {
        const pool = getPool();
        // Update the current session to belong to the user
        // We use session_token column for lookup if passed from client (usually 'sess_...')
        await pool.query(
            `UPDATE user_sessions SET user_id = $1 WHERE session_token = $2`,
            [userId, sessionId]
        );
    } catch (err) {
        logger.error('Failed to link session', err);
    }
}

// POST /api/auth/register
router.post('/register', async (req: AuthRequest, res: Response) => {
    const { email, password, fullName, sessionId } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const pool = getPool();

    try {
        // Check if user exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name) 
             VALUES ($1, $2, $3) 
             RETURNING id, email, full_name`,
            [email, hash, fullName || null]
        );

        const user = result.rows[0];

        // Link guest session if provided
        if (sessionId) {
            await linkSessionToUser(sessionId, user.id);
        }

        logger.info('User registered', { email: user.email });

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name
            }
        });

    } catch (error) {
        logger.error('Register error', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response) => {
    const { email, password, sessionId } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const pool = getPool();

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !user.password_hash) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Link session
        if (sessionId) {
            await linkSessionToUser(sessionId, user.id);
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name
            }
        });

    } catch (error) {
        logger.error('Login error', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// POST /api/auth/google
router.post('/google', async (req: AuthRequest, res: Response) => {
    const { credential, sessionId } = req.body;

    if (!credential) {
        return res.status(400).json({ success: false, error: 'Google credential required' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            throw new Error('Invalid Google Token payload');
        }

        const { email, sub: googleId, name } = payload;
        const pool = getPool();

        // Check if user exists by google_id OR email
        let result = await pool.query(
            'SELECT * FROM users WHERE google_id = $1 OR email = $2',
            [googleId, email]
        );

        let user = result.rows[0];

        if (user) {
            // Update google_id if missing (e.g. existing email user logging in with Google)
            if (!user.google_id) {
                await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
            }
        } else {
            // Create new user
            const newUser = await pool.query(
                `INSERT INTO users (email, google_id, full_name, is_verified) 
                 VALUES ($1, $2, $3, true) 
                 RETURNING *`,
                [email, googleId, name]
            );
            user = newUser.rows[0];
        }

        // Link session
        if (sessionId) {
            await linkSessionToUser(sessionId, user.id);
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name
            }
        });

    } catch (error) {
        logger.error('Google Auth error', error);
        res.status(500).json({ success: false, error: 'Google authentication failed' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', async (req: AuthRequest, res: Response) => {
    const { email, oldPassword, newPassword } = req.body;
    // Simple check: For now, require email + oldPassword even if logged in, just to be safe/simple
    // In a real app we'd use req.user from middleware

    if (!email || !oldPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'All fields required' });
    }

    const pool = getPool();
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !user.password_hash) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);

        logger.info('Password changed', { email });
        res.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        logger.error('Change password error', error);
        res.status(500).json({ success: false, error: 'Failed to update password' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: AuthRequest, res: Response) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    const pool = getPool();
    try {
        const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user) {
            // Generate simple token
            const token = Math.random().toString(36).substring(2, 15);
            // Store in DB
            await pool.query(
                `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
                [user.id, token]
            );

            // Log to console (STUB)
            logger.info(`[STUB] Password Reset Link for ${email}: http://localhost:3000/reset-password?token=${token}`);
        }

        // Always return success/message to prevent enumeration
        res.json({ success: true, message: 'If account exists, reset link sent.' });
    } catch (error) {
        logger.error('Forgot password error', error);
        res.status(500).json({ success: false, error: 'Request failed' });
    }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
    // This expects the client to send the session token in header or query
    // But commonly we might rely on the sessionId logic in middlewares
    // For now, let's allow passing sessionId in query to resolve user
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
        return res.json({ user: null });
    }

    const pool = getPool();
    try {
        const result = await pool.query(`
            SELECT u.id, u.email, u.full_name, u.is_verified
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = $1 AND s.expires_at > NOW()
        `, [sessionId]);

        if (result.rows.length === 0) {
            return res.json({ user: null });
        }

        res.json({ user: result.rows[0] });

    } catch (error) {
        logger.error('Auth check error', error);
        res.status(500).json({ success: false, error: 'Check failed' });
    }
});

export default router;
