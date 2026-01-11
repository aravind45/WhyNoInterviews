import express from 'express';
import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Middleware to check auth
const checkAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.headers['x-user-id'] as string;
    const sessionId = req.headers['x-session-id'] as string;

    if (!userId && !sessionId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing credentials' });
    }
    next();
};

// Save a new item
router.post('/', checkAuth, async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { type, content, metadata } = req.body;

    if (!type || !content) {
        return res.status(400).json({ success: false, error: 'Type and content are required' });
    }

    try {
        const sql = `
      INSERT INTO saved_items (user_id, type, content, metadata) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
        const values = [userId, type, content, JSON.stringify(metadata || {})];
        const result = await query(sql, values);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error saving item:', error);
        res.status(500).json({ success: false, error: 'Failed to save item' });
    }
});

// List items
router.get('/', checkAuth, async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { type } = req.query;

    try {
        let sql = 'SELECT * FROM saved_items WHERE user_id = $1';
        const values: any[] = [userId];

        if (type) {
            sql += ' AND type = $2';
            values.push(type);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await query(sql, values);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch items' });
    }
});

// Delete item
router.delete('/:id', checkAuth, async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    try {
        const sql = 'DELETE FROM saved_items WHERE id = $1 AND user_id = $2 RETURNING id';
        const result = await query(sql, [id, userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Item not found or unauthorized' });
        }

        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ success: false, error: 'Failed to delete item' });
    }
});

export default router;
