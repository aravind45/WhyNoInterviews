import { Router, Request, Response } from 'express';
import { checkAdmin } from '../middleware/admin';
import { logger } from '../utils/logger';

// Lazy load db to avoid circular dependency
// const getQuery = () => require('../database/connection').query;

const router = Router();

// Protect all admin routes
router.use(checkAdmin);

/**
 * GET /api/admin/stats
 * Returns system statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { query } = await import('../database/connection');
    const usersRes = await query(`SELECT COUNT(*) as count FROM user_sessions`);
    const analysesRes = await query(`SELECT COUNT(*) as count FROM resume_analyses`);
    const recentRes = await query(`
        SELECT COUNT(*) as count 
        FROM resume_analyses 
        WHERE created_at > NOW() - INTERVAL '24 HOURS'
    `);

    // Most recent users
    const recentUsers = await query(`
        SELECT email, created_at, is_pro 
        FROM user_sessions 
        ORDER BY created_at DESC LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(usersRes.rows[0]?.count || '0'),
        totalAnalyses: parseInt(analysesRes.rows[0]?.count || '0'),
        last24hAnalyses: parseInt(recentRes.rows[0]?.count || '0'),
        recentUsers: recentUsers.rows,
      },
    });
  } catch (error: any) {
    logger.error('Admin stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/init
 * Initialize system settings table
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    const { query } = await import('../database/connection');
    await query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(50) PRIMARY KEY,
                value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // Seed default price if missing
    await query(`
            INSERT INTO system_settings (key, value)
            VALUES ('pro_price_cents', '999')
            ON CONFLICT (key) DO NOTHING
        `);

    res.json({ success: true, message: 'System settings table initialized' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/config
 * Get current system config
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { query } = await import('../database/connection');
    const result = await query(`SELECT * FROM system_settings`);
    const config: Record<string, any> = {};
    result.rows.forEach((row: any) => {
      config[row.key] = row.value;
    });
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/config
 * Update specific config key
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { query } = await import('../database/connection');
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, error: 'Key and value required' });
    }

    await query(
      `
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) 
            DO UPDATE SET value = $2, updated_at = NOW()
        `,
      [key, String(value)],
    );

    res.json({ success: true, message: 'Config updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
