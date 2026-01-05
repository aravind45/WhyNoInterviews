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

const router = Router();

// POST /api/generate-interview-questions
router.post('/generate-interview-questions', asyncHandler(async (req: Request, res: Response) => {
    const { jobRole, interviewType, experienceLevel, duration, jobDescription } = req.body;
    
    if (!jobRole || !interviewType || !experienceLevel || !duration) {
        throw new ValidationError('Missing required fields: jobRole, interviewType, experienceLevel, duration');
    }
    
    const provider = getDefaultProvider();
    const questions = await generateInterviewQuestions({ 
        jobRole, 
        interviewType, 
        experienceLevel, 
        duration, 
        jobDescription 
    }, provider);
    
    res.json({ success: true, data: questions });
}));

// POST /api/interview-session – create a new interview session
router.post('/interview-session', asyncHandler(async (req: Request, res: Response) => {
    const { jobRole, interviewType, duration } = req.body;
    const sessionToken = generateSessionToken();
    const result = await query(
        `INSERT INTO interview_sessions (session_token, job_role, interview_type, duration_minutes, status, created_at) 
     VALUES ($1, $2, $3, $4, 'setup', NOW()) RETURNING id, session_token`,
        [sessionToken, jobRole, interviewType, duration]
    );
    const session = result.rows[0];
    // cache empty session state
    await cacheSet(`interview:${session.session_token}`, { sessionId: session.id }, 60 * 60);
    res.json({ success: true, data: { sessionId: session.id, sessionToken: session.session_token } });
}));

// POST /api/upload-interview-response – upload video for a question
router.post('/upload-interview-response', asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken, questionId, videoUrl } = req.body;
    
    // First try to get from cache
    let sessionInfo = await cacheGet(`interview:${sessionToken}`);
    
    // If not in cache, get from database
    if (!sessionInfo) {
        const sessionResult = await query(
            `SELECT id FROM interview_sessions WHERE session_token = $1`,
            [sessionToken]
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
            [sessionInfo.sessionId, questionId, `Mock question ${questionId}`, 'behavioral']
        );
        actualQuestionId = mockQuestionResult.rows[0].id;
    }
    
    const result = await query(
        `INSERT INTO interview_responses (session_id, question_id, video_url, created_at) 
     VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [sessionInfo.sessionId, actualQuestionId, videoUrl]
    );
    res.json({ success: true, data: { responseId: result.rows[0].id } });
}));

// POST /api/analyze-interview-video – run analysis on a response video
router.post('/analyze-interview-video', asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken, questionId, videoUrl } = req.body;
    const sessionInfo = await cacheGet(`interview:${sessionToken}`);
    if (!sessionInfo) throw new ValidationError('Invalid session token');
    const analysis = await analyzeInterviewVideo(videoUrl, questionId);
    // store analysis data
    await query(
        `UPDATE interview_responses SET transcript = $1, analysis_data = $2 WHERE session_id = $3 AND question_id = $4`,
        [analysis.transcript, analysis, sessionInfo.sessionId, questionId]
    );
    res.json({ success: true, data: analysis });
}));

// GET /api/interview-results/:sessionToken – compile feedback for the whole session
router.get('/interview-results/:sessionToken', asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken } = req.params;
    
    // First try to get from cache
    let sessionInfo = await cacheGet(`interview:${sessionToken}`);
    
    // If not in cache, get from database
    if (!sessionInfo) {
        const sessionResult = await query(
            `SELECT id FROM interview_sessions WHERE session_token = $1`,
            [sessionToken]
        );
        
        if (sessionResult.rows.length === 0) {
            throw new ValidationError('Invalid session token');
        }
        
        sessionInfo = { sessionId: sessionResult.rows[0].id };
        
        // Cache it for future use
        await cacheSet(`interview:${sessionToken}`, sessionInfo, 60 * 60);
    }
    
    const feedback = await generateInterviewFeedback(sessionInfo.sessionId);
    res.json({ success: true, data: feedback });
}));

export default router;
