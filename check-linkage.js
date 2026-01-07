const { Pool } = require('pg');
require('dotenv').config();

async function checkLinkage() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const email = 'aravind.77479@gmail.com';
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            console.log('User not found');
            return;
        }
        const userId = userRes.rows[0].id;
        console.log(`User ID for ${email}: ${userId}`);

        const sessionRes = await pool.query('SELECT id, session_token FROM user_sessions WHERE user_id = $1', [userId]);
        console.log(`Sessions linked to user: ${sessionRes.rows.length}`);
        console.log(sessionRes.rows);

        const analysesRes = await pool.query(`
      SELECT a.id, a.target_job_title, a.created_at 
      FROM resume_analyses a
      JOIN user_sessions s ON a.session_id = s.id
      WHERE s.user_id = $1
    `, [userId]);
        console.log(`Analyses linked to user: ${analysesRes.rows.length}`);
        console.log(analysesRes.rows);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkLinkage();
