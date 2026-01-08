const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('🔍 Listing all tables in current database...\n');
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    console.log('Tables found:');
    res.rows.forEach(row => console.log(`- ${row.table_name}`));

    console.log('\n🔍 Checking row counts for major tables:');
    for (const row of res.rows) {
      const countRes = await pool.query(`SELECT COUNT(*) FROM ${row.table_name}`);
      console.log(`${row.table_name}: ${countRes.rows[0].count} rows`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
})();
