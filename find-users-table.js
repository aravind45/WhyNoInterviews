const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkUsersInAllSchemas() {
    try {
        // Check for users table in ALL schemas
        console.log('=== Searching for users tables in ALL schemas ===');
        const result = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables 
      WHERE table_name LIKE '%user%'
      ORDER BY table_schema, table_name;
    `);
        console.table(result.rows);

        // Try neon_auth.users_sync
        console.log('\n=== Checking neon_auth.users_sync ===');
        try {
            const usersSync = await pool.query(`SELECT * FROM neon_auth.users_sync LIMIT 10`);
            console.log(`Found ${usersSync.rows.length} rows`);
            console.table(usersSync.rows);
        } catch (err) {
            console.log('Error:', err.message);
        }

        // Check if users table exists in public schema
        console.log('\n=== Checking public.users ===');
        try {
            const publicUsers = await pool.query(`SELECT * FROM public.users LIMIT 10`);
            console.log(`Found ${publicUsers.rows.length} rows`);
            console.table(publicUsers.rows);
        } catch (err) {
            console.log('Error:', err.message);
        }

        // List ALL tables in public schema
        console.log('\n=== ALL PUBLIC SCHEMA TABLES ===');
        const allTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
        console.log('Tables:', allTables.rows.map(r => r.table_name).join(', '));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkUsersInAllSchemas();
