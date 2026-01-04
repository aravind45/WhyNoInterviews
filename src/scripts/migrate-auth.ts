import { connectDatabase, getClient } from '../database/connection';
import { logger } from '../utils/logger';

async function migrateAuth() {
    await connectDatabase();
    const client = await getClient();
    try {
        logger.info('Starting Auth Migration...');
        await client.query('BEGIN');

        // 1. Create users table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        google_id VARCHAR(255) UNIQUE,
        full_name VARCHAR(100),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        logger.info('Created users table');

        // 2. Add user_id to user_sessions
        // Check if column exists first to avoid error on rerun
        const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='user_sessions' AND column_name='user_id';
    `);

        if (checkColumn.rows.length === 0) {
            await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
      `);
            logger.info('Added user_id to user_sessions');
        } else {
            logger.info('user_id column already exists in user_sessions');
        }

        // 3. Create password_resets table (stubbed for future usage)
        await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        logger.info('Created password_resets table');

        await client.query('COMMIT');
        logger.info('Auth Migration Completed Successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Auth Migration Failed:', error);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

// Handle execution
if (require.main === module) {
    // We need to ensure the pool is connected before running? 
    // The connection module usually exports a connected pool or we might need to init it.
    // Looking at connection.ts, it exports 'pool' which is a Pool instance, 
    // but we might need to verify env vars are loaded if running as standalone script.
    require('dotenv').config();
    // Re-import after config to ensure DB url is set
    migrateAuth();
}
