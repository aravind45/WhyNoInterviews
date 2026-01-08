import express from 'express';
import { practiceService } from '../services/practiceService';
import { AnalyticsService } from '../services/analyticsService';

// Extend Request to include session data from DB
interface RequestWithSession extends express.Request {
  sessionData?: {
    id: string;      // The session_id token (e.g. 'sess_...')
    dbId: string;    // The UUID primary key from user_sessions
    userId?: string; // The linked user_id if logged in
  };
}

const router = express.Router();

// Middleware to extract and verify session
const sessionMiddleware = async (req: RequestWithSession, res: express.Response, next: express.NextFunction) => {
  try {
    const sessionId = (req.get('X-Session-Id') || req.body.sessionId || req.query.sessionId) as string;

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Session ID required' });
    }

    const pool = getPool();
    const result = await pool.query(
      'SELECT id, user_id FROM user_sessions WHERE session_id = $1 AND is_active = true',
      [sessionId]
    );

    if (result.rows.length === 0) {
      // Create a temporary session if not found? 
      // Actually, for practice assessments, we should ensure the session exists.
      // But if it's a new visitor, they might not have a session in DB yet.
      // For now, let's treat it as unauthorized to force consistent session creation.
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }

    req.sessionData = {
      id: sessionId,
      dbId: result.rows[0].id,
      userId: result.rows[0].user_id
    };

    next();
  } catch (error) {
    console.error('Session middleware error:', error);
    res.status(500).json({ success: false, error: 'Session verification failed' });
  }
};

import { getPool } from '../database/connection';

/**
 * Create a new practice assessment
 * POST /api/practice/create-assessment
 */
router.post('/create-assessment', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const { name, description, assessmentType, icon, color } = req.body;
    const sessionId = req.sessionData?.dbId; // Use UUID for DB
    const userId = req.sessionData?.userId;
    const token = req.sessionData?.id; // String token for analytics

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!name || !assessmentType) {
      return res.status(400).json({
        success: false,
        error: 'Name and assessment type are required',
      });
    }

    const assessment = await practiceService.createAssessment({
      userId,
      sessionId,
      name,
      description,
      assessmentType,
      icon,
      color,
    });

    res.json({ success: true, assessment });

    // Analytics
    await AnalyticsService.logEvent({
      sessionId: token,
      userId,
      eventName: 'practice_assessment_created',
      eventCategory: 'practice',
      properties: {
        assessmentId: assessment.id,
        assessmentType,
        name,
      },
    });
  } catch (error: any) {
    console.error('Error creating assessment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate AI questions for an assessment
 * POST /api/practice/generate-questions
 */
router.post('/generate-questions', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const {
      assessmentId,
      jobRole,
      assessmentType,
      questionCount = 10,
      difficulty = 'medium',
      resumeContext,
      jobDescription,
    } = req.body;

    const sessionId = req.sessionData?.dbId; // Use UUID for DB
    const token = req.sessionData?.id; // String token for analytics
    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!assessmentId || !assessmentType) {
      return res.status(400).json({
        success: false,
        error: 'Assessment ID and assessment type are required',
      });
    }

    // Default jobRole to assessment name if not provided
    let finalJobRole = jobRole;
    if (!finalJobRole) {
      try {
        const assessment = await practiceService.getAssessmentWithQuestions(assessmentId);
        finalJobRole = assessment.name;
      } catch (e) {
        finalJobRole = 'Professional';
      }
    }

    // Generate questions using AI
    const questions = await practiceService.generateQuestions({
      jobRole: finalJobRole,
      assessmentType,
      questionCount,
      difficulty,
      resumeContext,
      jobDescription,
    });

    // Add questions to assessment
    await practiceService.addQuestionsToAssessment(assessmentId, questions);

    res.json({ success: true, questions });

    // Analytics
    await AnalyticsService.logEvent({
      sessionId: token,
      eventName: 'practice_questions_generated',
      eventCategory: 'practice',
      properties: {
        assessmentId,
        questionCount: questions.length,
        difficulty,
        jobRole: finalJobRole,
      },
    });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get user's assessments
 * GET /api/practice/assessments
 */
router.get('/assessments', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const sessionId = req.sessionData?.dbId; // Use UUID for DB
    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const assessments = await practiceService.getUserAssessments(sessionId);
    res.json({ success: true, assessments });
  } catch (error: any) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get specific assessment with questions
 * GET /api/practice/assessment/:id
 */
router.get('/assessment/:id', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const { id } = req.params;
    const sessionId = req.sessionData?.id;

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const assessment = await practiceService.getAssessmentWithQuestions(id);
    res.json({ success: true, assessment });
  } catch (error: any) {
    console.error('Error fetching assessment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Start a practice session
 * POST /api/practice/start-session
 */
router.post('/start-session', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const { assessmentId } = req.body;
    const sessionId = req.sessionData?.dbId; // Use UUID for DB
    const userId = req.sessionData?.userId;
    const token = req.sessionData?.id; // String token for analytics

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!assessmentId) {
      return res.status(400).json({
        success: false,
        error: 'Assessment ID is required',
      });
    }

    const practiceSession = await practiceService.startSession(assessmentId, userId, sessionId);

    res.json({ success: true, session: practiceSession });

    // Analytics
    await AnalyticsService.logEvent({
      sessionId: token,
      userId,
      eventName: 'practice_session_started',
      eventCategory: 'practice',
      properties: {
        assessmentId,
        sessionId: practiceSession.id,
      },
    });
  } catch (error: any) {
    console.error('Error starting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Submit an answer
 * POST /api/practice/submit-answer
 */
router.post('/submit-answer', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const {
      sessionPracticeId,
      questionId,
      userAnswer,
      timeSpent,
      aiHintUsed = false,
      aiExplanationUsed = false,
    } = req.body;

    const sessionId = req.sessionData?.id;
    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!sessionPracticeId || !questionId || userAnswer === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Session ID, question ID, and answer are required',
      });
    }

    const result = await practiceService.submitAnswer(
      sessionPracticeId,
      questionId,
      userAnswer,
      timeSpent,
      aiHintUsed,
      aiExplanationUsed,
    );

    res.json({ success: true, ...result });

    // Analytics
    await AnalyticsService.logEvent({
      sessionId: req.sessionData?.id,
      eventName: 'practice_answer_submitted',
      eventCategory: 'practice',
      properties: {
        sessionPracticeId,
        questionId,
        isCorrect: result.isCorrect,
        timeSpent,
        aiHintUsed,
        aiExplanationUsed,
      },
    });
  } catch (error: any) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Complete a practice session
 * POST /api/practice/complete-session
 */
router.post('/complete-session', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const { sessionPracticeId } = req.body;
    const sessionId = req.sessionData?.id;

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!sessionPracticeId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const result = await practiceService.completeSession(sessionPracticeId);
    res.json({ success: true, result });

    // Analytics
    await AnalyticsService.logEvent({
      sessionId: req.sessionData?.id,
      eventName: 'practice_session_completed',
      eventCategory: 'practice',
      properties: {
        sessionPracticeId,
        score: result.score,
        totalQuestions: result.total_questions,
      },
    });
  } catch (error: any) {
    console.error('Error completing session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get AI hint for a question
 * POST /api/practice/ai-hint
 */
router.post('/ai-hint', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const { questionId } = req.body;
    const sessionId = req.sessionData?.id;

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: 'Question ID is required',
      });
    }

    const hint = await practiceService.generateHint(questionId);
    res.json({ success: true, hint });

    // Analytics
    await AnalyticsService.logEvent({
      sessionId: req.sessionData?.id,
      eventName: 'practice_ai_hint_used',
      eventCategory: 'practice',
      properties: {
        questionId,
      },
    });
  } catch (error: any) {
    console.error('Error generating hint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get AI explanation for a question
 * POST /api/practice/ai-explanation
 */
router.post('/ai-explanation', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const { questionId } = req.body;
    const sessionId = req.sessionData?.id;

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: 'Question ID is required',
      });
    }

    const explanation = await practiceService.getExplanation(questionId);
    res.json({ success: true, explanation });

    // Analytics
    await AnalyticsService.logEvent({
      sessionId: req.sessionData?.id,
      eventName: 'practice_ai_explanation_used',
      eventCategory: 'practice',
      properties: {
        questionId,
      },
    });
  } catch (error: any) {
    console.error('Error generating explanation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get user's practice results
 * GET /api/practice/results
 */
router.get('/results', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const sessionId = req.sessionData?.dbId; // Use UUID for DB
    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const results = await practiceService.getUserResults(sessionId, limit);

    res.json({ success: true, results });
  } catch (error: any) {
    console.error('Error fetching results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete an assessment
 * DELETE /api/practice/assessment/:id
 */
router.delete('/assessment/:id', sessionMiddleware, async (req: RequestWithSession, res: express.Response) => {
  try {
    const { id } = req.params;
    const sessionId = req.sessionData?.dbId; // Use UUID for DB

    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    await practiceService.deleteAssessment(id, sessionId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting assessment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
