import type { Pool as pgPool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Simple in-memory store for mocks
const store: Record<string, any[]> = {
  users: [],
  user_sessions: [],
  resume_analyses: [],
  interview_sessions: [],
};

const generateId = () => Math.floor(Math.random() * 1000000).toString();

export const mockClient = {
  query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
    const query = text.trim().toLowerCase();

    // Handle NOW() and base health check
    if (query.includes('now()') && !query.includes('insert') && !query.includes('update')) {
      return { rows: [{ now: new Date(), db: 'test_db' }] };
    }

    // Handle TRUNCATE
    if (query.startsWith('truncate')) {
      Object.keys(store).forEach((key) => (store[key] = []));
      return { rows: [] };
    }

    // Handle INSERT INTO users
    if (query.startsWith('insert into users')) {
      const email = params?.[0];
      const fullName = params?.[2] || 'Test User';
      const user = { id: generateId(), email, full_name: fullName, password_hash: params?.[1] };
      store.users.push(user);
      return { rows: [user] };
    }

    // Handle SELECT FROM users
    if (query.includes('from users')) {
      const email = params?.[0];
      const user = store.users.find((u) => u.email === email || u.google_id === email);
      if (user) return { rows: [user] };

      // If it's a "SELECT id" check and user not found, return empty
      if (query.includes('select id') || query.includes('select *')) {
        return { rows: [] };
      }
      return { rows: [] };
    }

    // Handle INSERT INTO user_sessions
    if (query.startsWith('insert into user_sessions')) {
      const session = {
        id: generateId(),
        session_id: params?.[0],
        session_token: params?.[0],
        user_id: params?.[1],
      };
      store.user_sessions.push(session);
      return { rows: [session] };
    }

    // Handle SELECT FROM user_sessions
    if (query.includes('from user_sessions')) {
      const sessionId = params?.[0];
      const session = store.user_sessions.find(
        (s) => s.session_id === sessionId || s.session_token === sessionId,
      );
      if (session) {
        // Join with user if needed
        if (query.includes('join users')) {
          const user = store.users.find((u) => u.id === session.user_id);
          return { rows: [{ ...session, ...user, expires_at: new Date(Date.now() + 86400000) }] };
        }
        return { rows: [session] };
      }
      return { rows: [] };
    }

    // Handle INSERT INTO interview_sessions
    if (query.startsWith('insert into interview_sessions')) {
      const session = {
        id: generateId(),
        session_token: 'sess_' + generateId(),
        user_id: params?.[0],
      };
      store.interview_sessions.push(session);
      return { rows: [session] };
    }

    // Handle GET /api/interview-dashboard (multiple rows)
    if (query.includes('from interview_sessions') && query.includes('where user_id = $1')) {
      const userId = params?.[0];
      const userSessions = store.interview_sessions.filter((s) => s.user_id === userId);
      return { rows: userSessions };
    }

    // Handle INSERT INTO interview_questions
    if (query.startsWith('insert into interview_questions')) {
      const question = { id: generateId(), session_id: params?.[0], question_number: params?.[1] };
      return { rows: [question] };
    }

    // Handle INSERT INTO interview_responses
    if (query.startsWith('insert into interview_responses')) {
      const response = {
        id: generateId(),
        session_id: params?.[0],
        question_id: params?.[1],
        video_url: params?.[2],
      };
      return { rows: [response] };
    }

    // Handle INSERT INTO interview_results
    if (query.startsWith('insert into interview_results')) {
      const result = { id: generateId(), session_id: params?.[0] };
      return { rows: [result] };
    }

    // Handle UPDATE interview_responses (for analysis results)
    if (query.startsWith('update interview_responses')) {
      return { rows: [{ id: 'updated' }] };
    }

    // Handle UPDATE interview_sessions (for status)
    if (query.startsWith('update interview_sessions')) {
      return { rows: [{ id: 'updated' }] };
    }

    // Handle DELETE FROM interview_sessions
    if (query.startsWith('delete from interview_sessions')) {
      return { rows: [] };
    }

    // Generic handler for 'SELECT $1 as name'
    const aliasMatch = text.match(/as\s+([a-zA-Z0-9_]+)/i);
    if (aliasMatch && params && params.length > 0) {
      const alias = aliasMatch[1];
      return { rows: [{ [alias]: params[0] }] };
    }

    if (text.includes('$1 as request_id')) {
      return { rows: [{ request_id: params?.[0] }] };
    }

    return { rows: [{}] };
  }),
  release: jest.fn(),
};

export const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn().mockImplementation((text, params) => mockClient.query(text, params)),
  end: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

export const Pool = jest.fn().mockImplementation(() => mockPool);
export const Client = jest.fn().mockImplementation(() => mockClient);

export default {
  Pool,
  Client,
};
