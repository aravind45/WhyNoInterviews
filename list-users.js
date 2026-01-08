const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function listAllTables() {
  try {
    // First, list all tables
    console.log('=== ALL TABLES IN DATABASE ===');
    const tablesResult = await pool.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    console.table(tablesResult.rows);

    // Try different case variations of 'users'
    const variations = ['users', 'Users', 'USERS', 'USERs'];

    for (const tableName of variations) {
      try {
        console.log(`\n=== Trying table: ${tableName} ===`);
        const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        console.log(`Found ${result.rows[0].count} rows in "${tableName}"`);

        if (result.rows[0].count > 0) {
          const data = await pool.query(`SELECT id, email, full_name, created_at FROM "${tableName}" LIMIT 5`);
          console.table(data.rows);
        }
      } catch (err) {
        console.log(`Table "${tableName}" not found or error: ${err.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

listAllTables();
