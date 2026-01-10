const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function dumpContent() {
    try {
        console.log('Dumping strengths and improvements...');
        const res = await pool.query(`
      SELECT id, strengths, improvements 
      FROM interview_results 
      LIMIT 10
    `);

        res.rows.forEach(r => {
            console.log(`-- Row ${r.id} --`);
            console.log('Strengths:', r.strengths);
            console.log('Improvements:', r.improvements);

            try {
                if (r.strengths) JSON.parse(r.strengths);
            } catch (e) {
                console.error('❌ JSON.parse(strengths) failed:', e.message);
            }

            try {
                if (r.improvements) JSON.parse(r.improvements);
            } catch (e) {
                console.error('❌ JSON.parse(improvements) failed:', e.message);
            }
        });

    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        await pool.end();
    }
}

dumpContent();
