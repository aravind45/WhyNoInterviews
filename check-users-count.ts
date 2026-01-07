import { getPool, connectDatabase, closeDatabase } from './src/database/connection';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        await connectDatabase();
        const pool = getPool();
        const res = await pool.query('SELECT COUNT(*) FROM users');
        console.log('Users count:', res.rows[0].count);

        const sessions = await pool.query('SELECT COUNT(*) FROM user_sessions');
        console.log('Sessions count:', sessions.rows[0].count);
    } catch (e) {
        console.error(e);
    } finally {
        await closeDatabase();
    }
})();
