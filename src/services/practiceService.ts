import { getPool } from '../database/connection';
import { getProvider, getDefaultProvider, type LLMProvider } from './llmProvider';

interface CreateAssessmentParams {
  userId?: string;
  sessionId: string;
  name: string;
  description?: string;
  assessmentType: 'technical' | 'behavioral' | 'mixed' | 'interview';
  icon?: string;
  color?: string;
}

interface GenerateQuestionsParams {
  jobRole: string;
  assessmentType: 'technical' | 'behavioral' | 'mixed';
  questionCount: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  resumeContext?: string;
  jobDescription?: string;
}

interface Question {
  questionNumber: number;
  questionText: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: 'A' | 'B' | 'C' | 'D';
  questionType: 'multiple_choice' | 'open_ended';
  difficulty: 'easy' | 'medium' | 'hard';
  explanation?: string;
}

export class PracticeService {
  /**
   * Create a new practice assessment
   */
  async createAssessment(params: CreateAssessmentParams): Promise<any> {
    const {
      userId,
      sessionId,
      name,
      description,
      assessmentType,
      icon = '💼',
      color = '#4F46E5',
    } = params;

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO practice_assessments 
       (user_id, session_id, name, description, assessment_type, icon, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, sessionId, name, description, assessmentType, icon, color],
    );

    return result.rows[0];
  }

  /**
   * Generate interview questions using AI
   */
  async generateQuestions(params: GenerateQuestionsParams): Promise<Question[]> {
    const {
      jobRole,
      assessmentType,
      questionCount,
      difficulty = 'medium',
      resumeContext,
      jobDescription,
    } = params;

    const prompt = this.buildQuestionGenerationPrompt(
      jobRole,
      assessmentType,
      questionCount,
      difficulty,
      resumeContext,
      jobDescription,
    );

    try {

      // Primary: Try Groq first
      try {
        const provider = getProvider('groq');
        if (provider.isAvailable()) {
          const response = await provider.generateText(prompt);
          if (response) {
            const parsed = JSON.parse(response);
            return parsed.questions || [];
          }
        }
      } catch (groqError) {
        console.warn('Groq provider failed, attempting fallback...', groqError);
      }

      // Fallback: Explicitly try OpenAI if Groq failed
      console.warn('Attempting fallback to OpenAI...');
      const fallbackProvider = getProvider('openai');

      if (!fallbackProvider.isAvailable()) {
        console.error('OpenAI fallback not available');
        throw new Error('No AI provider available (Groq failed, OpenAI not configured)');
      }

      const response = await fallbackProvider.generateText(prompt);
      if (!response) {
        throw new Error('No response from AI');
      }

      const parsed = JSON.parse(response);
      return parsed.questions || [];
    } catch (error) {
      console.error('Error generating questions:', error);
      throw new Error('Failed to generate questions');
    }
  }


  /**
   * Build prompt for AI question generation
   */
  private buildQuestionGenerationPrompt(
    jobRole: string,
    assessmentType: string,
    questionCount: number,
    difficulty: string,
    resumeContext?: string,
    jobDescription?: string,
  ): string {
    const typeInstructions = {
      technical: 'technical skills, coding concepts, system design, and problem-solving',
      behavioral:
        'past experiences, teamwork, conflict resolution, and soft skills using the STAR method',
      mixed: 'a mix of technical and behavioral questions',
    };

    return `You are an expert interview coach. Generate ${questionCount} ${difficulty} ${assessmentType} interview questions for a ${jobRole} position.

${jobDescription ? `Job Description:\n${jobDescription}\n` : ''}
${resumeContext ? `Candidate Background:\n${resumeContext}\n` : ''}

Requirements:
- Focus on ${typeInstructions[assessmentType as keyof typeof typeInstructions]}
- Each question should be ${difficulty} difficulty
- For multiple choice questions, provide 4 options with one clearly correct answer
- Include detailed explanations for each answer
- Questions should be realistic and commonly asked in actual interviews
- Avoid overly generic questions

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "Question text here",
      "optionA": "First option",
      "optionB": "Second option",
      "optionC": "Third option",
      "optionD": "Fourth option",
      "correctAnswer": "A",
      "questionType": "multiple_choice",
      "difficulty": "${difficulty}",
      "explanation": "Detailed explanation of why this answer is correct and why others are wrong"
    }
  ]
}

For behavioral questions, use questionType: "open_ended" and omit options and correctAnswer.`;
  }

  /**
   * Add questions to an assessment
   */
  async addQuestionsToAssessment(assessmentId: string, questions: Question[]): Promise<void> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const q of questions) {
        await client.query(
          `INSERT INTO practice_questions 
           (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, 
            correct_answer, question_type, difficulty, explanation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            assessmentId,
            q.questionNumber,
            q.questionText,
            q.optionA,
            q.optionB,
            q.optionC,
            q.optionD,
            q.correctAnswer,
            q.questionType,
            q.difficulty,
            q.explanation,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's assessments
   */
  async getUserAssessments(sessionId: string): Promise<any[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM practice_assessments 
       WHERE session_id = $1 
       ORDER BY created_at DESC`,
      [sessionId],
    );

    return result.rows;
  }

  /**
   * Get assessment with questions
   */
  async getAssessmentWithQuestions(assessmentId: string): Promise<any> {
    const pool = getPool();
    const assessmentResult = await pool.query('SELECT * FROM practice_assessments WHERE id = $1', [
      assessmentId,
    ]);

    if (assessmentResult.rows.length === 0) {
      throw new Error('Assessment not found');
    }

    const questionsResult = await pool.query(
      `SELECT * FROM practice_questions 
       WHERE assessment_id = $1 
       ORDER BY question_number`,
      [assessmentId],
    );

    return {
      ...assessmentResult.rows[0],
      questions: questionsResult.rows,
    };
  }

  /**
   * Start a practice session
   */
  async startSession(assessmentId: string, userId?: string, sessionId?: string): Promise<any> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO practice_sessions 
       (user_id, session_id, assessment_id, status, current_question_number)
       VALUES ($1, $2, $3, 'in_progress', 1)
       RETURNING *`,
      [userId, sessionId, assessmentId],
    );

    return result.rows[0];
  }

  /**
   * Submit an answer
   */
  async submitAnswer(
    sessionPracticeId: string,
    questionId: string,
    userAnswer: string,
    timeSpent: number,
    aiHintUsed: boolean = false,
    aiExplanationUsed: boolean = false,
  ): Promise<{ isCorrect: boolean; correctAnswer?: string }> {
    // Get the question to check answer
    const pool = getPool();
    const questionResult = await pool.query('SELECT * FROM practice_questions WHERE id = $1', [
      questionId,
    ]);

    const question = questionResult.rows[0];
    let isCorrect = false;

    if (question.question_type === 'multiple_choice') {
      isCorrect = userAnswer.toUpperCase() === question.correct_answer;
    }

    // Save the answer
    const result = await pool.query(
      `INSERT INTO practice_answers 
       (session_practice_id, question_id, user_answer, is_correct, time_spent, 
        ai_hint_used, ai_explanation_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (session_practice_id, question_id) 
       DO UPDATE SET 
         user_answer = EXCLUDED.user_answer,
         is_correct = EXCLUDED.is_correct,
         time_spent = EXCLUDED.time_spent,
         ai_hint_used = EXCLUDED.ai_hint_used,
         ai_explanation_used = EXCLUDED.ai_explanation_used`,
      [
        sessionPracticeId,
        questionId,
        userAnswer,
        isCorrect,
        timeSpent,
        aiHintUsed,
        aiExplanationUsed,
      ],
    );

    return {
      isCorrect,
      correctAnswer: question.correct_answer,
    };
  }

  /**
   * Complete a practice session and save results
   */
  async completeSession(sessionPracticeId: string): Promise<any> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get session details
      const sessionResult = await client.query(`SELECT * FROM practice_sessions WHERE id = $1`, [
        sessionPracticeId,
      ]);
      const session = sessionResult.rows[0];

      // Get all answers
      const answersResult = await client.query(
        `SELECT * FROM practice_answers WHERE session_practice_id = $1`,
        [sessionPracticeId],
      );
      const answers = answersResult.rows;

      // Calculate score
      const score = answers.filter((a: any) => a.is_correct).length;
      const totalQuestions = answers.length;
      const hintsUsed = answers.filter((a: any) => a.ai_hint_used).length;
      const explanationsUsed = answers.filter((a: any) => a.ai_explanation_used).length;

      // Calculate total time
      const timeElapsed = Math.floor(
        (new Date().getTime() - new Date(session.started_at).getTime()) / 1000,
      );

      // Update session status
      await client.query(
        `UPDATE practice_sessions 
         SET status = 'completed', completed_at = NOW(), time_elapsed = $1
         WHERE id = $2`,
        [timeElapsed, sessionPracticeId],
      );

      // Generate AI feedback
      const aiFeedback = await this.generateSessionFeedback(
        score,
        totalQuestions,
        answers,
        session.assessment_id,
      );

      // Save results
      const resultInsert = await client.query(
        `INSERT INTO practice_results 
         (user_id, session_id, assessment_id, practice_session_id, score, total_questions, 
          time_taken, hints_used, explanations_used, ai_feedback)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          session.user_id,
          session.session_id,
          session.assessment_id,
          sessionPracticeId,
          score,
          totalQuestions,
          timeElapsed,
          hintsUsed,
          explanationsUsed,
          aiFeedback,
        ],
      );

      await client.query('COMMIT');
      return resultInsert.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate AI feedback for completed session
   */
  private async generateSessionFeedback(
    score: number,
    totalQuestions: number,
    answers: any[],
    assessmentId: string,
  ): Promise<any> {
    const percentage = Math.round((score / totalQuestions) * 100);
    const incorrectCount = totalQuestions - score;

    const prompt = `You are an interview coach providing feedback on a practice interview session.

Results:
- Score: ${score}/${totalQuestions} (${percentage}%)
- Questions answered incorrectly: ${incorrectCount}

Provide constructive feedback in JSON format:
{
  "overallFeedback": "Brief overall assessment (2-3 sentences)",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["area to improve 1", "area to improve 2"],
  "nextSteps": ["specific action 1", "specific action 2"]
}

Be encouraging but honest. Focus on actionable advice.`;

    try {
      const provider = getProvider(getDefaultProvider());

      if (!provider.isAvailable()) {
        return null;
      }

      const response = await provider.generateText(prompt);

      return response ? JSON.parse(response) : null;
    } catch (error) {
      console.error('Error generating feedback:', error);
      return null;
    }
  }

  /**
   * Generate AI hint for a question
   */
  async generateHint(questionId: string): Promise<string> {
    const pool = getPool();
    const questionResult = await pool.query('SELECT * FROM practice_questions WHERE id = $1', [
      questionId,
    ]);

    const question = questionResult.rows[0];

    const prompt = `You are an interview coach. A candidate is practicing and needs a subtle hint for this question:

Question: ${question.question_text}
${question.option_a ? `Options:\nA) ${question.option_a}\nB) ${question.option_b}\nC) ${question.option_c}\nD) ${question.option_d}` : ''}

Provide a brief, strategic hint (2-3 sentences) that guides their thinking WITHOUT revealing the answer. Focus on:
- Key concepts to consider
- Common pitfalls to avoid
- Framework to structure their thinking

Hint:`;

    try {
      // Use default provide which handles selection, but wrap in try catch to be safe
      try {
        const provider = getProvider(getDefaultProvider());
        if (!provider.isAvailable()) {
          throw new Error('No AI provider available');
        }
        const response = await provider.generateText(prompt);
        return response || 'Unable to generate hint';
      } catch (err) {
        console.error('Error using default provider for hint, attempting forced fallback to OpenAI if not already used', err);
        // Last resort fallback
        const openai = getProvider('openai');
        if (openai.isAvailable()) {
          const response = await openai.generateText(prompt);
          return response || 'Unable to generate hint';
        }
        throw err;
      }
    } catch (error) {
      console.error('Error generating hint:', error);
      throw new Error('Failed to generate hint');
    }
  }

  /**
   * Get detailed explanation for a question
   */
  async getExplanation(questionId: string): Promise<string> {
    const pool = getPool();
    const questionResult = await pool.query('SELECT * FROM practice_questions WHERE id = $1', [
      questionId,
    ]);

    const question = questionResult.rows[0];

    // If explanation exists in DB, return it
    if (question.explanation) {
      return question.explanation;
    }

    // Otherwise generate it with AI
    const prompt = `You are an interview coach. Explain this interview question and its answer in detail:

Question: ${question.question_text}
${question.option_a ? `Options:\nA) ${question.option_a}\nB) ${question.option_b}\nC) ${question.option_c}\nD) ${question.option_d}` : ''}
${question.correct_answer ? `Correct Answer: ${question.correct_answer}` : ''}

Provide a comprehensive explanation covering:
1. What the question is testing
2. Why the correct answer is right
3. Why other options are wrong (if applicable)
4. How to approach similar questions in real interviews

Explanation:`;

    try {
      const provider = getProvider(getDefaultProvider());

      if (!provider.isAvailable()) {
        throw new Error('No AI provider available');
      }

      const response = await provider.generateText(prompt);

      return response || 'Unable to generate explanation';
    } catch (error) {
      console.error('Error generating explanation:', error);
      throw new Error('Failed to generate explanation');
    }
  }

  /**
   * Get user's practice results history
   */
  async getUserResults(sessionId: string, limit: number = 10): Promise<any[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT pr.*, pa.name as assessment_name, pa.assessment_type
       FROM practice_results pr
       JOIN practice_assessments pa ON pr.assessment_id = pa.id
       WHERE pr.session_id = $1
       ORDER BY pr.created_at DESC
       LIMIT $2`,
      [sessionId, limit],
    );

    return result.rows;
  }

  /**
   * Delete an assessment
   */
  async deleteAssessment(assessmentId: string, sessionId: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM practice_assessments WHERE id = $1 AND session_id = $2', [
      assessmentId,
      sessionId,
    ]);
  }

  /**
   * Generate job description-based interview prep with SAR answers
   */
  async generateJobBasedInterviewPrep(params: {
    jobDescription: string;
    resumeText?: string;
    companyName?: string;
  }): Promise<any> {
    const { jobDescription, resumeText, companyName } = params;

    // Extract company name from job description if not provided
    const extractedCompanyName = companyName || this.extractCompanyName(jobDescription);

    // Extract achievements from resume for SAR answers
    const achievements = resumeText ? this.extractAchievements(resumeText) : [];

    const prompt = `You are an expert interview coach. Generate personalized interview questions and SAR (Situation-Action-Result) based answers for this specific job.

JOB DESCRIPTION:
${jobDescription.substring(0, 3000)}

${resumeText ? `CANDIDATE'S RESUME CONTEXT:
${resumeText.substring(0, 2000)}` : ''}

${extractedCompanyName ? `COMPANY: ${extractedCompanyName}` : ''}

KEY ACHIEVEMENTS FROM RESUME:
${achievements.length > 0 ? achievements.map((a, i) => `${i + 1}. ${a}`).join('\n') : 'Professional experience as detailed in resume'}

Generate 15 interview questions specifically tailored to this job description, with personalized SAR-based answers using ONLY the candidate's actual experience.

For each question, provide:
1. The question text
2. A personalized answer using the SAR (Situation-Action-Result) framework
3. Tips for delivering the answer effectively

Focus on:
- Questions that directly relate to the job requirements
- Behavioral questions that can be answered with specific examples from the resume
- Technical questions relevant to the role
- Company-specific questions if company name is available

Return ONLY valid JSON in this format:
{
  "companyName": "${extractedCompanyName || 'the company'}",
  "questions": [
    {
      "question": "Tell me about a time when you...",
      "sarAnswer": {
        "situation": "Specific situation from resume",
        "action": "Actions taken by the candidate",
        "result": "Measurable results achieved"
      },
      "fullAnswer": "Complete answer combining SAR elements naturally",
      "tips": "Brief tip on how to deliver this answer effectively"
    }
  ],
  "questionsToAsk": [
    "What does success look like in this role?",
    "What are the biggest challenges the team is currently facing?",
    "How does this role contribute to the company's goals?",
    "What opportunities are there for professional development?",
    "Can you describe the team I'd be working with?",
    "What are the next steps in the interview process?"
  ]
}

CRITICAL RULES:
- Use ONLY information from the provided resume
- Do NOT fabricate achievements, skills, or experience
- If resume lacks specific examples, suggest general professional responses
- Keep answers authentic and factual
- Focus on measurable results where possible
- Tailor questions to the specific job requirements mentioned`;

    try {

      // Primary: Try Groq first
      try {
        const provider = getProvider('groq');
        if (provider.isAvailable()) {
          const response = await provider.generateText(prompt);
          if (response) {
            return this.parseJobPrepResponse(response);
          }
        }
      } catch (groqError) {
        console.warn('Groq provider failed for job prep, attempting fallback...', groqError);
      }

      // Fallback: Explicitly try OpenAI if Groq failed
      console.warn('Attempting fallback to OpenAI...');
      const fallbackProvider = getProvider('openai');

      if (!fallbackProvider.isAvailable()) {
        console.error('OpenAI fallback not available');
        throw new Error('No AI provider available (Groq failed, OpenAI not configured)');
      }

      const response = await fallbackProvider.generateText(prompt);
      if (!response) {
        throw new Error('No response from AI');
      }

      return this.parseJobPrepResponse(response);

    } catch (error) {
      console.error('Error generating job-based interview prep:', error);
      throw new Error('Failed to generate interview preparation');
    }
  }


  /**
   * Helper to parse job prep response
   */
  private parseJobPrepResponse(jsonText: string): any {
    // Strip markdown code blocks if present (OpenAI sometimes wraps JSON in ```json blocks)
    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```\s*/g, '').replace(/```\s*$/g, '');
    }
    return JSON.parse(jsonText);
  }


  /**
   * Extract company name from job description
   */
  private extractCompanyName(jobDescription: string): string {
    const companyMatch = jobDescription.match(
      /(?:at|@|company[:\s]+|about[:\s]+)([A-Z][a-zA-Z0-9\s&]+?)(?:\.|,|\n|is|we|has)/i,
    );
    return companyMatch?.[1]?.trim() || '';
  }

  /**
   * Extract achievements from resume text
   */
  private extractAchievements(resumeText: string): string[] {
    const achievementPatterns = [
      /(?:led|managed|built|developed|created|launched|designed|implemented|reduced|increased|improved|saved|generated|grew|scaled)[^.]+\d+[^.]+\./gi,
      /\d+%[^.]+\./gi,
      /\$[\d,]+[^.]+\./gi,
      /(?:achieved|delivered|completed|exceeded)[^.]+(?:\d+|significant|substantial)[^.]+\./gi,
    ];

    let achievements: string[] = [];
    achievementPatterns.forEach((pattern) => {
      const matches = resumeText.match(pattern);
      if (matches) achievements.push(...matches);
    });

    // Remove duplicates and limit to top 10
    return [...new Set(achievements)].slice(0, 10);
  }
}

export const practiceService = new PracticeService();
