const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function showUsers() {
    try {
        console.log('=== REGISTERED USERS ===\n');

        const result = await pool.query(`
      SELECT 
        id,
        email,
        full_name,
        google_id,
        is_verified,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at DESC
    `);

        console.log(`Total users: ${result.rows.length}\n`);

        if (result.rows.length > 0) {
            console.table(result.rows);
        } else {
            console.log('No users found in the database.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

showUsers();
