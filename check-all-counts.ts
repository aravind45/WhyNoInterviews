import { getPool, connectDatabase, closeDatabase } from './src/database/connection';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        await connectDatabase();
        const pool = getPool();

        const tablesRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
        `);

        console.log('--- Table Row Counts ---');
        for (const row of tablesRes.rows) {
            const tableName = row.table_name;
            try {
                const countRes = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);
                console.log(`${tableName}: ${countRes.rows[0].count}`);
            } catch (err) {
                console.log(`${tableName}: ERROR (${err.message})`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await closeDatabase();
    }
})();
