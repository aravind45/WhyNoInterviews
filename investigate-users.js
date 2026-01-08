const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function detailedUserCheck() {
    try {
        console.log('=== DETAILED USER INVESTIGATION ===\n');

        // 1. Check all users
        console.log('1. ALL USERS IN DATABASE:');
        const allUsers = await pool.query(`
      SELECT 
        id,
        email,
        full_name,
        google_id,
        password_hash IS NOT NULL as has_password,
        is_verified,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);
        console.log(`Total: ${allUsers.rows.length}`);
        console.table(allUsers.rows);

        // 2. Search for specific email
        console.log('\n2. SEARCHING FOR aravind45@gmail.com:');
        const specificUser = await pool.query(`
      SELECT * FROM users WHERE email LIKE '%aravind45%' OR email LIKE '%aravind.77479%'
    `);
        console.log(`Found: ${specificUser.rows.length}`);
        if (specificUser.rows.length > 0) {
            console.table(specificUser.rows);
        }

        // 3. Check user_sessions
        console.log('\n3. RECENT USER SESSIONS:');
        const sessions = await pool.query(`
      SELECT 
        us.id,
        us.session_id,
        us.user_id,
        u.email,
        us.created_at,
        us.expires_at,
        us.is_active
      FROM user_sessions us
      LEFT JOIN users u ON us.user_id = u.id
      ORDER BY us.created_at DESC
      LIMIT 10
    `);
        console.log(`Total sessions: ${sessions.rows.length}`);
        console.table(sessions.rows);

        // 4. Check if there are any Google OAuth users
        console.log('\n4. GOOGLE OAUTH USERS:');
        const googleUsers = await pool.query(`
      SELECT email, google_id, created_at 
      FROM users 
      WHERE google_id IS NOT NULL
    `);
        console.log(`Total Google users: ${googleUsers.rows.length}`);
        if (googleUsers.rows.length > 0) {
            console.table(googleUsers.rows);
        }

        // 5. Check password-based users
        console.log('\n5. PASSWORD-BASED USERS:');
        const passwordUsers = await pool.query(`
      SELECT email, created_at 
      FROM users 
      WHERE password_hash IS NOT NULL
    `);
        console.log(`Total password users: ${passwordUsers.rows.length}`);
        if (passwordUsers.rows.length > 0) {
            console.table(passwordUsers.rows);
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

detailedUserCheck();
