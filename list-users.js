require('dotenv').config();
const { Pool } = require('pg');

async function checkUsers() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query('SELECT id, email, full_name, is_verified, created_at FROM users');
        console.log('--- Users Table ---');
        console.log(`Total users: ${res.rowCount}`);
        res.rows.forEach(user => {
            console.log(`- ${user.email} (${user.full_name || 'No Name'})`);
        });
    } catch (err) {
        console.error('Error querying users table:', err.message);
    } finally {
        await pool.end();
    }
}

checkUsers();
