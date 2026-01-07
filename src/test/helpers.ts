import { getPool } from '../database/connection';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export async function clearDatabase() {
  const pool = getPool();
  // Truncate user-generated data tables
  await pool.query(`
    TRUNCATE TABLE 
      users, 
      user_sessions, 
      resume_analyses, 
      diagnosis_results,
      interview_sessions, 
      interview_questions, 
      interview_responses, 
      interview_results,
      linkedin_contacts, 
      contact_import_batches,
      contact_interactions,
      job_searches, 
      job_listings, 
      job_applications
    CASCADE
  `);
}

export async function createTestUser(email = 'test@example.com', password = 'Password123') {
  const pool = getPool();
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, is_verified) 
     VALUES ($1, $2, 'Test User', true) 
     RETURNING *`,
    [email, hash],
  );
  return result.rows[0];
}

export async function createTestSession(userId: string) {
  const pool = getPool();
  const sessionId = uuidv4();
  const sessionToken = 'sess_' + sessionId;

  const result = await pool.query(
    `INSERT INTO user_sessions (session_token, user_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 day')
         RETURNING id, session_token`,
    [sessionToken, userId],
  );
  return result.rows[0];
}
