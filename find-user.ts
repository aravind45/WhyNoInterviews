import { getPool, connectDatabase, closeDatabase } from './src/database/connection';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    await connectDatabase();
    const pool = getPool();
    const email = 'aravind.77479@gmail.com';

    console.log(`Searching for ${email}...`);
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('User record:', JSON.stringify(res.rows, null, 2));

    const sessions = await pool.query(
      `
            SELECT s.* 
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE u.email = $1
        `,
      [email],
    );
    console.log('Sessions for user:', JSON.stringify(sessions.rows, null, 2));

    const allUsers = await pool.query('SELECT email FROM users');
    console.log(
      'All user emails:',
      allUsers.rows.map((r) => r.email),
    );
  } catch (e) {
    console.error(e);
  } finally {
    await closeDatabase();
  }
})();
