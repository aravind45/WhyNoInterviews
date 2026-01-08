const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('🔍 Querying users table for aravind45@gmail.com...\n');

        const result = await pool.query(
            `SELECT 
        id, 
        email, 
        full_name, 
        google_id, 
        password_hash,
        is_verified,
        created_at, 
        updated_at 
      FROM users 
      WHERE email = $1`,
            ['aravind45@gmail.com']
        );

        if (result.rows.length === 0) {
            console.log('❌ No user found with email aravind45@gmail.com');
        } else {
            console.log('✅ User found in database:\n');
            console.log(JSON.stringify(result.rows[0], null, 2));
            console.log('\n📊 User Details:');
            console.log(`   ID: ${result.rows[0].id}`);
            console.log(`   Email: ${result.rows[0].email}`);
            console.log(`   Full Name: ${result.rows[0].full_name}`);
            console.log(`   Google ID: ${result.rows[0].google_id}`);
            console.log(`   Password Hash: ${result.rows[0].password_hash ? '[SET]' : '[NULL - Google OAuth only]'}`);
            console.log(`   Verified: ${result.rows[0].is_verified}`);
            console.log(`   Created: ${result.rows[0].created_at}`);
            console.log(`   Updated: ${result.rows[0].updated_at}`);
        }

        // Also show total user count
        const countResult = await pool.query('SELECT COUNT(*) FROM users');
        console.log(`\n📈 Total users in database: ${countResult.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error querying database:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
})();
