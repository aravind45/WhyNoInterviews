import { closeDatabase, connectDatabase } from '../database/connection';
import dotenv from 'dotenv';
import path from 'path';

// Load test env vars early
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Mock logger to reduce noise during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

beforeAll(async () => {
  // Silence console logs if needed, or redirect
  // console.log = jest.fn();

  try {
    // Attempt connection
    await connectDatabase();
  } catch (error) {
    // If it fails here, individual tests might fail or we might be mocking DB in unit tests
    // For integration tests, we need this.
    // console.error('Test DB connection failed:', error);
  }
});

afterAll(async () => {
  await closeDatabase();
});
