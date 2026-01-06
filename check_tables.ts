import { getPool, connectDatabase, closeDatabase } from './src/database/connection';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        await connectDatabase();
        const pool = getPool();
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        console.log('Tables:', res.rows.map(r => r.table_name));
    } catch (e) {
        console.error(e);
    } finally {
        await closeDatabase();
    }
})();
