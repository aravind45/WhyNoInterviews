import { Router, Request, Response } from 'express';
import { practiceService } from '../services/practiceService';

// Extend Request to include session
interface Session {
  id: string;
  userId?: string;
}

interface RequestWithSession extends Request {
  session?: Session;
}

const router = Router();

/**
 * Create a new practice assessment
 * POST /api/practice/create-assessment
 */
router.post('/create-assessment', async (req: RequestWithSession, res: Response) => {
  try {
    const { name, description, assessmentType, icon, color } = req.body;
    const sessionId = req.session?.id;
    const userId = req.session?.userId;

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
  } catch (error: any) {
    console.error('Error creating assessment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate AI questions for an assessment
 * POST /api/practice/generate-questions
 */
router.post('/generate-questions', async (req: RequestWithSession, res: Response) => {
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

    const sessionId = req.session?.id;
    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!assessmentId || !jobRole || !assessmentType) {
      return res.status(400).json({
        success: false,
        error: 'Assessment ID, job role, and assessment type are required',
      });
    }

    // Generate questions using AI
    const questions = await practiceService.generateQuestions({
      jobRole,
      assessmentType,
      questionCount,
      difficulty,
      resumeContext,
      jobDescription,
    });

    // Add questions to assessment
    await practiceService.addQuestionsToAssessment(assessmentId, questions);

    res.json({ success: true, questions });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get user's assessments
 * GET /api/practice/assessments
 */
router.get('/assessments', async (req: RequestWithSession, res: Response) => {
  try {
    const sessionId = req.session?.id;
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
router.get('/assessment/:id', async (req: RequestWithSession, res: Response) => {
  try {
    const { id } = req.params;
    const sessionId = req.session?.id;

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
router.post('/start-session', async (req: RequestWithSession, res: Response) => {
  try {
    const { assessmentId } = req.body;
    const sessionId = req.session?.id;
    const userId = req.session?.userId;

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
  } catch (error: any) {
    console.error('Error starting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Submit an answer
 * POST /api/practice/submit-answer
 */
router.post('/submit-answer', async (req: RequestWithSession, res: Response) => {
  try {
    const {
      sessionPracticeId,
      questionId,
      userAnswer,
      timeSpent,
      aiHintUsed = false,
      aiExplanationUsed = false,
    } = req.body;

    const sessionId = req.session?.id;
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
  } catch (error: any) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Complete a practice session
 * POST /api/practice/complete-session
 */
router.post('/complete-session', async (req: RequestWithSession, res: Response) => {
  try {
    const { sessionPracticeId } = req.body;
    const sessionId = req.session?.id;

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
  } catch (error: any) {
    console.error('Error completing session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get AI hint for a question
 * POST /api/practice/ai-hint
 */
router.post('/ai-hint', async (req: RequestWithSession, res: Response) => {
  try {
    const { questionId } = req.body;
    const sessionId = req.session?.id;

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
  } catch (error: any) {
    console.error('Error generating hint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get AI explanation for a question
 * POST /api/practice/ai-explanation
 */
router.post('/ai-explanation', async (req: RequestWithSession, res: Response) => {
  try {
    const { questionId } = req.body;
    const sessionId = req.session?.id;

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
  } catch (error: any) {
    console.error('Error generating explanation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get user's practice results
 * GET /api/practice/results
 */
router.get('/results', async (req: RequestWithSession, res: Response) => {
  try {
    const sessionId = req.session?.id;
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
router.delete('/assessment/:id', async (req: RequestWithSession, res: Response) => {
  try {
    const { id } = req.params;
    const sessionId = req.session?.id;

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
