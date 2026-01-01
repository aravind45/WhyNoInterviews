const { Pool } = require('pg');
require('dotenv').config();

async function checkSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking database schema...\n');
    
    // Check users table structure
    const usersSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('👤 Users table columns:');
    usersSchema.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check sessions table structure
    const sessionsSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n🔐 Sessions table columns:');
    sessionsSchema.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check if we have session_token or session_id
    const hasSessionToken = sessionsSchema.rows.some(row => row.column_name === 'session_token');
    const hasSessionId = sessionsSchema.rows.some(row => row.column_name === 'session_id');
    
    console.log('\n📋 Session column analysis:');
    console.log(`  - Has session_token: ${hasSessionToken}`);
    console.log(`  - Has session_id: ${hasSessionId}`);
    
    if (hasSessionToken && !hasSessionId) {
      console.log('\n⚠️  ISSUE: Table has session_token but code expects session_id');
    } else if (!hasSessionToken && hasSessionId) {
      console.log('\n✅ CORRECT: Table has session_id as expected by code');
    } else if (hasSessionToken && hasSessionId) {
      console.log('\n🤔 BOTH: Table has both columns - need to standardize');
    } else {
      console.log('\n❌ ERROR: No session column found');
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();