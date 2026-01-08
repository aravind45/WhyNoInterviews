
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://neondb_owner:npg_EJaq0VAklM4o@ep-green-bar-ahj4m4hv-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');

async function initializeDatabase() {
    console.log('🚀 Wiping and initializing new database schema...');
    const pool = new Pool({ connectionString });

    try {
        console.log('🧹 Dropping existing public schema...');
        await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await pool.query('GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO neondb_owner;');

        console.log('⏳ Running schema.sql...');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✅ Schema initialized successfully!');

        // Check tables
        const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('📋 Tables created:', tablesRes.rows.map(r => r.table_name).join(', '));

    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
    } finally {
        await pool.end();
    }
}

initializeDatabase();
