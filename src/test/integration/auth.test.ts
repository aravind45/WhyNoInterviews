import request from 'supertest';
import app from '../../index';
import { clearDatabase, createTestUser } from '../helpers';
import { closeDatabase, connectDatabase } from '../../database/connection';

// Mock Google Auth Library
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: jest.fn().mockReturnValue({
            email: 'google@test.com',
            sub: 'google-123',
            name: 'Google User',
          }),
        }),
      };
    }),
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    // Ensure database is initialized for tests
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
    }
    await connectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe('newuser@example.com');
    });

    it('should fail if email already exists', async () => {
      await createTestUser('dup@example.com', 'pass');

      const res = await request(app).post('/api/auth/register').send({
        email: 'dup@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already registered/i);
    });

    it('should require email and password', async () => {
      const res = await request(app).post('/api/auth/register').send({ fullName: 'No Creds' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      await createTestUser('login@example.com', 'password123');

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('login@example.com');
    });

    it('should reject invalid password', async () => {
      await createTestUser('login@example.com', 'password123');

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'WRONG',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'ghost@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/google', () => {
    it('should authenticate with google token', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'mock-valid-token' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('google@test.com');
      expect(res.body.user.fullName).toBe('Google User');
    });

    it('should require credential', async () => {
      const res = await request(app).post('/api/auth/google').send({});

      expect(res.status).toBe(400);
    });
  });
});
