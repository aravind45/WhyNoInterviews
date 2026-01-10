// src/routes/mockInterview.ts
import { Router, Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { generateSessionToken } from '../services/encryption';
import { query, transaction } from '../database/connection';
import { cacheSet, cacheGet } from '../cache/redis';
import { logger } from '../utils/logger';
import { ValidationError, ProcessingError } from '../types';
import { getProvider, getDefaultProvider } from '../services/llmProvider';
import { generateInterviewQuestions } from '../services/questionGenerator';
import { analyzeInterviewVideo } from '../services/videoAnalysis';
import { generateInterviewFeedback } from '../services/feedbackGenerator';
import { rateLimitLLM, incrementLLMUsageFromRequest } from '../middleware/llmRateLimit';

const router = Router();

// POST /api/generate-interview-questions
router.post(
  '/generate-interview-questions',
  rateLimitLLM,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobRole, interviewType, experienceLevel, duration, jobDescription } = req.body;

    if (!jobRole || !interviewType || !experienceLevel || !duration) {
      throw new ValidationError(
        'Missing required fields: jobRole, interviewType, experienceLevel, duration',
      );
    }

    const provider = getDefaultProvider();
    const questions = await generateInterviewQuestions(
      {
        jobRole,
        interviewType,
        experienceLevel,
        duration,
        jobDescription,
      },
      provider,
    );

    // Increment LLM usage counter
    await incrementLLMUsageFromRequest(req);

    res.json({ success: true, data: questions });
  }),
);

// POST /api/interview-session – create a new interview session
router.post(
  '/interview-session',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobRole, interviewType, duration } = req.body;
    const sessionToken = generateSessionToken();

    // Get user ID from session token or direct user ID
    let userId = null;
    const clientSessionId = req.body.sessionId || req.headers['x-session-id'];
    const directUserId = req.headers['x-user-id'] as string;

    // Try direct user ID first
    if (directUserId) {
      userId = directUserId;
      logger.info('Interview session: Using direct user ID', { userId });
    } else if (clientSessionId) {
      try {
        // Look up user from session
        const sessionResult = await query(
          `SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true`,
          [clientSessionId],
        );

        if (sessionResult.rows.length > 0 && sessionResult.rows[0].user_id) {
          userId = sessionResult.rows[0].user_id;
          logger.info('Interview session: Found user from session', {
            sessionId: clientSessionId,
            userId,
          });
        }
      } catch (error) {
        logger.warn('Failed to lookup user from session:', error);
      }
    }

    logger.info('Creating interview session', { userId, jobRole, interviewType, duration });

    const result = await query(
      `INSERT INTO interview_sessions (session_token, user_id, job_role, interview_type, duration_minutes, status, created_at) 
     VALUES ($1, $2, $3, $4, $5, 'setup', NOW()) RETURNING id, session_token`,
      [sessionToken, userId, jobRole, interviewType, duration],
    );
    const session = result.rows[0];
    // cache empty session state
    await cacheSet(
      `interview:${session.session_token}`,
      { sessionId: session.id, userId },
      60 * 60,
    );
    res.json({
      success: true,
      data: { sessionId: session.id, sessionToken: session.session_token },
    });
  }),
);

// POST /api/upload-interview-response – upload video for a question
router.post(
  '/upload-interview-response',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken, questionId, videoUrl } = req.body;

    // First try to get from cache
    let sessionInfo = await cacheGet(`interview:${sessionToken}`);

    // If not in cache, get from database
    if (!sessionInfo) {
      const sessionResult = await query(
        `SELECT id FROM interview_sessions WHERE session_token = $1`,
        [sessionToken],
      );

      if (sessionResult.rows.length === 0) {
        throw new ValidationError('Invalid session token');
      }

      sessionInfo = { sessionId: sessionResult.rows[0].id };

      // Cache it for future use
      await cacheSet(`interview:${sessionToken}`, sessionInfo, 60 * 60);
    }

    // For testing purposes, if questionId is a number, create a mock question
    let actualQuestionId = questionId;
    if (typeof questionId === 'number' || !questionId.includes('-')) {
      // Create a mock question for testing
      const mockQuestionResult = await query(
        `INSERT INTO interview_questions (session_id, question_number, question_text, question_type, expected_duration_seconds)
             VALUES ($1, $2, $3, $4, 180) RETURNING id`,
        [sessionInfo.sessionId, questionId, `Mock question ${questionId}`, 'behavioral'],
      );
      actualQuestionId = mockQuestionResult.rows[0].id;
    }

    const result = await query(
      `INSERT INTO interview_responses (session_id, question_id, video_url, created_at) 
     VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [sessionInfo.sessionId, actualQuestionId, videoUrl],
    );
    res.json({ success: true, data: { responseId: result.rows[0].id } });
  }),
);

// POST /api/analyze-interview-video – run analysis on a response video
router.post(
  '/analyze-interview-video',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken, questionId, videoUrl } = req.body;
    let sessionInfo = await cacheGet(`interview:${sessionToken}`);

    if (!sessionInfo) {
      const sessionResult = await query(
        `SELECT id FROM interview_sessions WHERE session_token = $1`,
        [sessionToken],
      );

      if (sessionResult.rows.length === 0) {
        throw new ValidationError('Invalid session token');
      }

      sessionInfo = { sessionId: sessionResult.rows[0].id };
      await cacheSet(`interview:${sessionToken}`, sessionInfo, 60 * 60);
    }

    const analysis = await analyzeInterviewVideo(videoUrl, questionId);
    // store analysis data
    await query(
      `UPDATE interview_responses SET transcript = $1, analysis_data = $2 WHERE session_id = $3 AND question_id = $4`,
      [analysis.transcript, analysis, sessionInfo.sessionId, questionId],
    );
    res.json({ success: true, data: analysis });
  }),
);

// GET /api/interview-results/:sessionToken – compile feedback for the whole session
router.get(
  '/interview-results/:sessionToken',
  rateLimitLLM,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken } = req.params;

    // First try to get from cache
    let sessionInfo = await cacheGet(`interview:${sessionToken}`);

    // If not in cache, get from database
    if (!sessionInfo) {
      const sessionResult = await query(
        `SELECT id FROM interview_sessions WHERE session_token = $1`,
        [sessionToken],
      );

      if (sessionResult.rows.length === 0) {
        throw new ValidationError('Invalid session token');
      }

      sessionInfo = { sessionId: sessionResult.rows[0].id };

      // Cache it for future use
      await cacheSet(`interview:${sessionToken}`, sessionInfo, 60 * 60);
    }

    const feedback = await generateInterviewFeedback(sessionInfo.sessionId);

    // Calculate average confidence from detailed feedback
    const avgConfidence =
      feedback.detailedFeedback?.length > 0
        ? Math.round(
          feedback.detailedFeedback.reduce(
            (sum: number, f: any) => sum + (f.tone?.confident || 0),
            0,
          ) / feedback.detailedFeedback.length,
        )
        : 0;

    // Store the results in the database for dashboard access
    try {
      await query(
        `INSERT INTO interview_results (session_id, overall_score, communication_score, technical_score, confidence_score, strengths, improvements, detailed_feedback, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (session_id) DO UPDATE SET
             overall_score = EXCLUDED.overall_score,
             communication_score = EXCLUDED.communication_score,
             technical_score = EXCLUDED.technical_score,
             confidence_score = EXCLUDED.confidence_score,
             strengths = EXCLUDED.strengths,
             improvements = EXCLUDED.improvements,
             detailed_feedback = EXCLUDED.detailed_feedback`,
        [
          sessionInfo.sessionId,
          feedback.overallScore || 0,
          (feedback.rubrics?.communication?.score || 0) * 20,
          (feedback.rubrics?.technicalKnowledge?.score || 0) * 20,
          avgConfidence,
          JSON.stringify(feedback.strengths || []),
          JSON.stringify(feedback.growthAreas || []),
          JSON.stringify(feedback),
        ],
      );

      // Update session status to completed
      await query(
        `UPDATE interview_sessions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [sessionInfo.sessionId],
      );
    } catch (error) {
      logger.error('Error storing interview results:', error);
      // Don't fail the request if storage fails
    }

    // Increment LLM usage counter (successful feedback generation)
    await incrementLLMUsageFromRequest(req);

    res.json({ success: true, data: feedback });
  }),
);

// GET /api/interview-dashboard – get user's interview history
router.get(
  '/interview-dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    // Get user ID from session or direct user ID header
    let userId = null;
    const clientSessionId =
      (req.headers['x-session-id'] as string) || (req.query.sessionId as string);
    const directUserId = req.headers['x-user-id'] as string;

    // Try direct user ID first
    if (directUserId) {
      userId = directUserId;
      logger.info('Dashboard: Using direct user ID', { userId });
    } else if (clientSessionId) {
      try {
        // Look up user from session
        const sessionResult = await query(
          `SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true`,
          [clientSessionId],
        );

        if (sessionResult.rows.length > 0 && sessionResult.rows[0].user_id) {
          userId = sessionResult.rows[0].user_id;
          logger.info('Dashboard: Found user from session', { sessionId: clientSessionId, userId });
        }
      } catch (error) {
        logger.warn('Failed to lookup user from session:', error);
      }
    }

    if (!userId) {
      logger.warn('Dashboard: No user ID found', { sessionId: clientSessionId, directUserId });
      return res.json({
        success: true,
        data: { interviews: [], message: 'Please log in to view your interview history' },
      });
    }

    try {
      // Get user's interview sessions with results
      const result = await query(
        `
            SELECT 
                s.id,
                s.session_token,
                s.job_role,
                s.interview_type,
                s.duration_minutes,
                s.status,
                s.created_at,
                s.completed_at,
                r.overall_score,
                r.communication_score,
                r.technical_score,
                r.confidence_score,
                r.strengths,
                r.improvements,
                COUNT(resp.id) as total_questions
            FROM interview_sessions s
            LEFT JOIN interview_results r ON s.id = r.session_id
            LEFT JOIN interview_responses resp ON s.id = resp.session_id
            WHERE s.user_id = $1
            GROUP BY s.id, r.id
            ORDER BY s.created_at DESC
            LIMIT 50
        `,
        [userId],
      );

      logger.info('Dashboard: Found interviews', { userId, count: result.rows.length });

      const safeParse = (jsonString: string) => {
        try {
          if (!jsonString) return [];
          return JSON.parse(jsonString);
        } catch (e) {
          logger.warn('Dashboard: Failed to parse JSON', { json: jsonString?.substring(0, 100) });
          return [];
        }
      };

      const interviews = result.rows.map((row) => ({
        id: row.id,
        sessionToken: row.session_token,
        jobRole: row.job_role,
        interviewType: row.interview_type,
        duration: row.duration_minutes,
        status: row.status,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        totalQuestions: parseInt(row.total_questions) || 0,
        results: row.overall_score
          ? {
            overallScore: row.overall_score,
            categoryScores: {
              communication: row.communication_score,
              technical: row.technical_score,
              confidence: row.confidence_score,
            },
            strengths: safeParse(row.strengths),
            improvements: safeParse(row.improvements),
          }
          : null,
      }));

      // Calculate summary stats
      const completedInterviews = interviews.filter((i) => i.status === 'completed' && i.results);
      const avgScore =
        completedInterviews.length > 0
          ? Math.round(
            completedInterviews.reduce((sum, i) => sum + (i.results?.overallScore || 0), 0) /
            completedInterviews.length,
          )
          : 0;

      const summary = {
        totalInterviews: interviews.length,
        completedInterviews: completedInterviews.length,
        averageScore: avgScore,
        lastInterviewDate: interviews.length > 0 ? interviews[0].createdAt : null,
      };

      res.json({
        success: true,
        data: {
          interviews,
          summary,
        },
      });
    } catch (error) {
      logger.error('Error fetching interview dashboard:', error);
      throw new ProcessingError('Failed to fetch interview history');
    }
  }),
);

// DELETE /api/interview-session/:id – delete an interview session
router.delete(
  '/interview-session/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Get user ID from session
    let userId = null;
    const clientSessionId =
      (req.headers['x-session-id'] as string) || (req.query.sessionId as string);

    if (clientSessionId) {
      try {
        // Look up user from session
        const sessionResult = await query(
          `SELECT user_id FROM user_sessions WHERE session_id = $1 AND is_active = true`,
          [clientSessionId],
        );

        if (sessionResult.rows.length > 0 && sessionResult.rows[0].user_id) {
          userId = sessionResult.rows[0].user_id;
        }
      } catch (error) {
        logger.warn('Failed to lookup user from session:', error);
      }
    }

    if (!userId) {
      throw new ValidationError('Authentication required');
    }

    // Verify the interview belongs to the user
    const checkResult = await query(
      `SELECT id FROM interview_sessions WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      throw new ValidationError('Interview not found or access denied');
    }

    // Delete the interview (cascade will handle related records)
    await query(`DELETE FROM interview_sessions WHERE id = $1`, [id]);

    res.json({ success: true, message: 'Interview deleted successfully' });
  }),
);

export default router;
