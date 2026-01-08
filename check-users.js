const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkUsers() {
    try {
        const result = await pool.query(`
      SELECT id, email, full_name, google_id, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

        console.log('Registered Users:');
        console.table(result.rows);
        console.log(`\nTotal users: ${result.rows.length}`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkUsers();
