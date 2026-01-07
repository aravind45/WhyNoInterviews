const { Pool } = require('pg');
require('dotenv').config();

async function fixForeignKey() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Dropping old foreign key...');
        await pool.query('ALTER TABLE user_sessions DROP CONSTRAINT user_sessions_user_id_fkey');

        console.log('Adding new foreign key pointing to users(id)...');
        await pool.query('ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');

        console.log('Success!');

        // Now try to link the user again
        const email = 'aravind.77479@gmail.com';
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length > 0) {
            const userId = userRes.rows[0].id;
            const updateRes = await pool.query('UPDATE user_sessions SET user_id = $1 WHERE user_id IS NULL', [userId]);
            console.log(`Linked ${updateRes.rowCount} sessions to ${email}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixForeignKey();
