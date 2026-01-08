const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('📊 DATABASE VERIFICATION REPORT 📊\n');

        // Check Users
        const users = await pool.query('SELECT id, email, full_name, created_at FROM users');
        console.log(`👥 USERS TABLE (${users.rowCount} rows):`);
        users.rows.forEach(u => {
            console.log(`   - ID: ${u.id}`);
            console.log(`     Email: ${u.email}`);
            console.log(`     Name: ${u.full_name}`);
            console.log(`     Created: ${u.created_at}`);
            console.log('     -------------------');
        });

        // Check Sessions
        const sessions = await pool.query('SELECT session_id, user_id, is_active FROM user_sessions');
        console.log(`\n⏳ SESSIONS TABLE (${sessions.rowCount} rows):`);
        sessions.rows.forEach(s => {
            console.log(`   - Session ID: ${s.session_id}`);
            console.log(`     Linked User ID: ${s.user_id || 'NULL'}`);
            console.log(`     Active: ${s.is_active}`);
            console.log('     -------------------');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
})();
