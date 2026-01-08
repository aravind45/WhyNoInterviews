const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('🔍 Checking session linkage for aravind45@gmail.com...\n');

    // Get user
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', ['aravind45@gmail.com']);
    if (userRes.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    const userId = userRes.rows[0].id;
    console.log(`✅ User ID: ${userId}`);

    // Check sessions
    const sessionRes = await pool.query(
      'SELECT session_id, created_at, expires_at, is_active FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    if (sessionRes.rows.length === 0) {
      console.log('❌ No sessions linked to this user');
    } else {
      console.log(`✅ Found ${sessionRes.rows.length} sessions linked to this user:`);
      sessionRes.rows.forEach(s => {
        console.log(`   - Session: ${s.session_id}, Created: ${s.created_at}, Active: ${s.is_active}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
})();
