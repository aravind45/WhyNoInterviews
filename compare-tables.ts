import { getPool, connectDatabase, closeDatabase } from './src/database/connection';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        await connectDatabase();
        const pool = getPool();

        const users = await pool.query('SELECT COUNT(*) FROM users');
        console.log('Users count:', users.rows[0].count);

        try {
            const profiles = await pool.query('SELECT COUNT(*) FROM user_profiles');
            console.log('User_profiles count:', profiles.rows[0].count);
        } catch (e) {
            console.log('User_profiles table might not exist or error:', e.message);
        }

        const allUsers = await pool.query('SELECT email FROM users');
        console.log('Emails in users:', allUsers.rows.map(r => r.email));

    } catch (e) {
        console.error(e);
    } finally {
        await closeDatabase();
    }
})();
