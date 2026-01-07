const { Pool } = require('pg');
require('dotenv').config();

async function checkProfiles() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const res = await pool.query('SELECT * FROM user_profiles');
    console.log('--- User Profiles ---');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkProfiles();
