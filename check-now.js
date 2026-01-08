const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkNow() {
    try {
        console.log('=== CHECKING DATABASE RIGHT NOW ===\n');

        // Check all users
        const allUsers = await pool.query(`
      SELECT 
        id,
        email,
        full_name,
        google_id,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);

        console.log(`Total users: ${allUsers.rows.length}\n`);
        console.table(allUsers.rows);

        // Check for Aravind specifically
        const aravind = await pool.query(`
      SELECT * FROM users 
      WHERE email LIKE '%aravind%' 
      OR full_name LIKE '%Aravind%'
    `);

        console.log(`\nAravind users found: ${aravind.rows.length}`);
        if (aravind.rows.length > 0) {
            console.table(aravind.rows);
        } else {
            console.log('❌ NO ARAVIND USER IN DATABASE');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkNow();
