const { Pool } = require('pg');
require('dotenv').config();

async function checkCounts() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);

    console.log('--- Row Counts ---');
    for (const table of tables.rows) {
      const name = table.table_name;
      const countRes = await pool.query(`SELECT COUNT(*) FROM "${name}"`);
      console.log(`${name}: ${countRes.rows[0].count}`);
    }

    const userRes = await pool.query('SELECT email FROM users');
    console.log(
      '\nEmails in users table:',
      userRes.rows.map((r) => r.email),
    );
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCounts();
