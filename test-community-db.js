// Test Community Database Connection
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testCommunityTables() {
    try {
        console.log('Testing database connection...');

        // Test connection
        const client = await pool.connect();
        console.log('✅ Connected to database');

        // Check if tables exist
        const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'community%'
      ORDER BY table_name
    `);

        console.log('\n📋 Community Tables Found:');
        tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));

        // Check community_posts structure
        console.log('\n📊 community_posts columns:');
        const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'community_posts'
      ORDER BY ordinal_position
    `);

        columnsResult.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });

        // Try a simple query
        console.log('\n🔍 Testing SELECT query...');
        const testQuery = await client.query('SELECT COUNT(*) FROM community_posts');
        console.log(`  Posts count: ${testQuery.rows[0].count}`);

        // Try the actual query from the route
        console.log('\n🔍 Testing actual route query...');
        const routeQuery = `
      SELECT 
        p.*,
        u.full_name as author_name,
        u.email as author_email,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', l.id, 'user_id', l.user_id)
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'
        ) as likes
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN community_likes l ON p.id = l.post_id
      WHERE p.is_flagged = false
      GROUP BY p.id, u.full_name, u.email
      ORDER BY p.created_at DESC
      LIMIT 20 OFFSET 0
    `;

        const result = await client.query(routeQuery);
        console.log(`  ✅ Query successful! Found ${result.rows.length} posts`);

        client.release();
        console.log('\n✅ All tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

testCommunityTables();
