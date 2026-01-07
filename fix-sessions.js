const { Pool } = require('pg');
require('dotenv').config();

async function fixUserSessions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const email = 'aravind.77479@gmail.com';
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (userRes.rows.length === 0) {
      console.log('User not found');
      return;
    }

    const userId = userRes.rows[0].id;
    console.log('User ID:', userId);

    const updateRes = await pool.query(
      'UPDATE user_sessions SET user_id = $1 WHERE user_id IS NULL',
      [userId],
    );
    console.log('Updated sessions:', updateRes.rowCount);

    const verifyRes = await pool.query(
      `
      SELECT s.session_id, u.email 
      FROM user_sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE u.email = $1
    `,
      [email],
    );

    console.log('--- Verification ---');
    console.log(`User ${email} is now linked to ${verifyRes.rows.length} sessions.`);
    verifyRes.rows.forEach((r) => console.log(`- Session: ${r.session_id}`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixUserSessions();
