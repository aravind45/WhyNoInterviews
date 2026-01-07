const { Pool } = require('pg');
require('dotenv').config();

async function testSessionDirect() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🧪 Testing session creation directly...\n');

    // Test session creation
    const testSessionId = 'test-session-' + Date.now();

    console.log('1. Creating test session...');
    const result = await pool.query(
      `INSERT INTO user_sessions (session_id, ip_address, user_agent, expires_at, is_active)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', true)
       RETURNING id, session_id`,
      [testSessionId, '127.0.0.1', 'Test Agent'],
    );

    console.log('✅ Session created successfully!');
    console.log('Database ID:', result.rows[0].id);
    console.log('Session ID:', result.rows[0].session_id);

    // Test session lookup
    console.log('\n2. Testing session lookup...');
    const lookupResult = await pool.query(
      'SELECT id, session_id FROM user_sessions WHERE session_id = $1',
      [testSessionId],
    );

    if (lookupResult.rows.length > 0) {
      console.log('✅ Session lookup successful!');
      console.log('Found session:', lookupResult.rows[0]);
    } else {
      console.log('❌ Session lookup failed');
    }

    // Clean up test session
    await pool.query('DELETE FROM user_sessions WHERE session_id = $1', [testSessionId]);
    console.log('\n✅ Test session cleaned up');

    console.log('\n🎉 Session token fix is working correctly!');
  } catch (error) {
    console.error('❌ Session test failed:', error.message);
    if (error.message.includes('session_token')) {
      console.error('❌ Still has session_token column reference!');
    }
  } finally {
    await pool.end();
  }
}

testSessionDirect();
