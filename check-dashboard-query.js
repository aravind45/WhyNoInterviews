const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkColumns() {
    try {
        console.log('Checking column types for interview_results...');
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'interview_results'
    `);

        console.log('Columns:');
        res.rows.forEach(r => {
            console.log(`- ${r.column_name}: ${r.data_type}`);
        });

    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        await pool.end();
    }
}

checkColumns();
