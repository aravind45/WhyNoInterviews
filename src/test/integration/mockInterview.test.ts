import request from 'supertest';
import app from '../../index';
import { clearDatabase, createTestUser } from '../helpers';
import { closeDatabase } from '../../database/connection';

// Mock dependencies
jest.mock('../../services/videoAnalysis', () => ({
  analyzeInterviewVideo: jest.fn().mockResolvedValue({
    transcript: 'This is a mock transcript of the interview response.',
    duration: 120,
    audio_url: 'http://mock/audio.mp3',
    confidence: 0.95,
  }),
}));

jest.mock('../../services/llmProvider', () => {
  return {
    getProvider: jest.fn().mockReturnValue({
      isAvailable: () => true,
      generateText: jest.fn().mockResolvedValue(
        JSON.stringify({
          overallScore: 85,
          rubrics: {
            communication: {
              score: 4,
              feedback: 'Good',
              improvements: 'None',
              showInsights: false,
            },
            technicalKnowledge: {
              score: 5,
              feedback: 'Excellent',
              improvements: 'None',
              showInsights: false,
            },
          },
          strengths: ['Strong technical skills'],
          growthAreas: ['Speak slower'],
          detailedFeedback: [],
          summary: ['Great interview'],
          nextSteps: ['Hire'],
        }),
      ),
    }),
    getDefaultProvider: jest.fn().mockReturnValue('groq'),
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Mock Interview Integration Tests', () => {
  let user: any;
  let sessionToken: string;
  let sessionId: string;

  beforeEach(async () => {
    await clearDatabase();
    user = await createTestUser();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('End-to-End Mock Interview Flow', () => {
    it('should generate interview questions', async () => {
      const res = await request(app).post('/api/generate-interview-questions').send({
        jobRole: 'Software Engineer',
        interviewType: 'technical',
        experienceLevel: 'mid',
        duration: 30,
        jobDescription: 'React and Node developer',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toHaveProperty('text');
    });

    it('should create an interview session', async () => {
      const res = await request(app)
        .post('/api/interview-session')
        .set('x-user-id', user.id) // Simulate authenticated user
        .send({
          jobRole: 'Software Engineer',
          interviewType: 'technical',
          duration: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('sessionToken');

      sessionToken = res.body.data.sessionToken;
      sessionId = res.body.data.sessionId; // Assuming backend returns ID too? Checked route: yes { sessionId, sessionToken }
    });

    it('should upload a response (mock video)', async () => {
      // Need a valid session first
      const sessionRes = await request(app)
        .post('/api/interview-session')
        .set('x-user-id', user.id)
        .send({ jobRole: 'Dev', interviewType: 'technical', duration: 15 });

      sessionToken = sessionRes.body.data.sessionToken;

      const res = await request(app).post('/api/upload-interview-response').send({
        sessionToken,
        questionId: 1, // Number triggers mock question logic in route
        videoUrl: 'http://mock-storage.com/video.webm',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('responseId');
    });

    it('should analyze a response', async () => {
      // Setup session
      const sessionRes = await request(app)
        .post('/api/interview-session')
        .set('x-user-id', user.id)
        .send({ jobRole: 'Dev', interviewType: 'technical', duration: 15 });
      sessionToken = sessionRes.body.data.sessionToken;

      // Analyze
      const res = await request(app).post('/api/analyze-interview-video').send({
        sessionToken,
        questionId: 1,
        videoUrl: 'http://mock-storage.com/video.webm',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Check if mock analysis data is returned
      expect(res.body.data.transcript).toContain('Mock transcript');
    });

    it('should generate final results', async () => {
      // Setup & add response
      const sessionRes = await request(app)
        .post('/api/interview-session')
        .set('x-user-id', user.id)
        .send({ jobRole: 'Dev', interviewType: 'technical', duration: 15 });
      sessionToken = sessionRes.body.data.sessionToken;

      // Generate results
      const res = await request(app).get(`/api/interview-results/${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overallScore).toBe(85);
    });

    it('should retrieve interview dashboard', async () => {
      // Create a session first so dashboard is not empty (though creating it doesn't mean completed)
      await request(app)
        .post('/api/interview-session')
        .set('x-user-id', user.id)
        .send({ jobRole: 'Dev', interviewType: 'technical', duration: 15 });

      const res = await request(app).get('/api/interview-dashboard').set('x-user-id', user.id);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.interviews).toBeDefined();
      // Should verify structure
      expect(res.body.data.summary).toBeDefined();
    });
  });
});
