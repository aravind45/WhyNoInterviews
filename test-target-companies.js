const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://neondb_owner:npg_U1ZDnWkKoIj9@ep-quiet-heart-ahc56mo8-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
      AND table_name LIKE '%target%' OR table_name LIKE '%company%'
      ORDER BY table_name
    `);
    
    console.log('📊 Tables created:');
    tables.rows.forEach(r => console.log(`   - ${r.table_name}`));

    // Check company suggestions
    const companies = await client.query('SELECT company_name, industry FROM global_company_suggestions ORDER BY company_name');
    
    console.log(`\n🏢 ${companies.rows.length} Companies available:`);
    companies.rows.forEach(c => console.log(`   - ${c.company_name} (${c.industry})`));

    console.log('\n✅ Migration successful! The feature should now work.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

test();
