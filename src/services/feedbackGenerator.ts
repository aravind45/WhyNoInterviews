// src/services/feedbackGenerator.ts
import { query } from '../database/connection';
import { getProvider, getDefaultProvider } from './llmProvider';

export interface InterviewFeedback {
    overallScore: number;
    categoryScores: {
        communication: number;
        technical: number;
        confidence: number;
        bodyLanguage: number;
    };
    strengths: string[];
    improvements: string[];
    detailedFeedback: {
        questionId: number;
        visualScore: number;
        audioScore: number;
        transcript: string;
        notes: string;
    }[];
    nextSteps: string[];
}

/**
 * Generate interview feedback from session ID using AI analysis
 */
export async function generateInterviewFeedback(sessionId: string): Promise<InterviewFeedback> {
    // Fetch session details
    const sessionResult = await query(
        `SELECT * FROM interview_sessions WHERE id = $1`,
        [sessionId]
    );

    if (sessionResult.rows.length === 0) {
        throw new Error('Interview session not found');
    }

    const session = sessionResult.rows[0];

    // Fetch all responses for this session
    const responsesResult = await query(
        `SELECT ir.*, iq.question_text, iq.question_type 
         FROM interview_responses ir
         JOIN interview_questions iq ON ir.question_id = iq.id
         WHERE ir.session_id = $1 ORDER BY iq.question_number`,
        [sessionId]
    );

    const responses = responsesResult.rows;

    if (responses.length === 0) {
        // Return default feedback if no responses
        return {
            overallScore: 0,
            categoryScores: { communication: 0, technical: 0, confidence: 0, bodyLanguage: 0 },
            strengths: [],
            improvements: ['Complete the interview to receive feedback'],
            detailedFeedback: [],
            nextSteps: ['Start recording your responses to get AI-powered feedback']
        };
    }

    // Generate AI-powered feedback
    try {
        const provider = getProvider(getDefaultProvider());
        
        if (provider.isAvailable()) {
            return await generateAIFeedback(session, responses, provider);
        }
    } catch (error) {
        console.error('Error generating AI feedback:', error);
    }

    // Fallback to rule-based feedback
    return generateRuleBasedFeedback(session, responses);
}

async function generateAIFeedback(session: any, responses: any[], provider: any): Promise<InterviewFeedback> {
    const feedbackPrompt = `You are an expert interview coach and technical recruiter with 15+ years of experience. Analyze this mock interview performance and provide detailed, actionable feedback.

INTERVIEW CONTEXT:
- Job Role: ${session.job_role}
- Interview Type: ${session.interview_type}
- Duration: ${session.duration_minutes} minutes
- Number of Responses: ${responses.length}

CANDIDATE RESPONSES:
${responses.map((r, i) => `
QUESTION ${i + 1} (${r.question_type}): ${r.question_text}
Response Duration: ${r.response_duration_seconds || 'Not recorded'} seconds
Transcript: ${r.transcript || 'No transcript available'}
Analysis Data: ${JSON.stringify(r.analysis_data || {})}
`).join('\n')}

EVALUATION FRAMEWORK:

COMMUNICATION ASSESSMENT (0-100):
- Clarity and articulation of ideas
- Structure and logical flow of responses
- Use of specific examples and concrete details
- Ability to explain complex concepts simply
- Confidence in delivery without being arrogant

TECHNICAL COMPETENCE (0-100):
- Depth of knowledge in relevant areas
- Problem-solving approach and methodology
- Understanding of best practices and trade-offs
- Ability to discuss technical decisions and rationale
- Awareness of current industry trends and tools

BEHAVIORAL COMPETENCE (0-100):
- Use of STAR method (Situation, Task, Action, Result)
- Demonstration of leadership and collaboration skills
- Self-awareness and ability to learn from mistakes
- Growth mindset and adaptability
- Cultural fit and team dynamics

OVERALL PRESENCE (0-100):
- Professional demeanor and confidence
- Engagement and enthusiasm for the role
- Ability to ask thoughtful questions
- Recovery from difficult questions
- Authenticity and genuineness

FEEDBACK QUALITY STANDARDS:
- Be specific and actionable, not generic
- Reference actual examples from their responses
- Provide concrete improvement strategies
- Balance constructive criticism with encouragement
- Focus on behaviors that can be improved with practice

Return feedback in this exact JSON format:
{
  "overallScore": 85,
  "categoryScores": {
    "communication": 80,
    "technical": 90,
    "confidence": 85,
    "bodyLanguage": 75
  },
  "strengths": [
    "Provided specific, measurable examples when discussing past projects",
    "Demonstrated strong problem-solving methodology with clear step-by-step approach",
    "Showed excellent self-awareness when discussing areas for improvement"
  ],
  "improvements": [
    "Structure responses using the STAR method for better clarity and impact",
    "Provide more specific technical details when explaining implementation decisions",
    "Practice maintaining eye contact and confident posture throughout responses"
  ],
  "nextSteps": [
    "Practice the STAR method with 3-5 prepared stories covering different competencies",
    "Research the company's technical stack and prepare specific questions about their architecture",
    "Record yourself answering common questions to improve delivery and reduce filler words",
    "Prepare thoughtful questions about team dynamics, growth opportunities, and technical challenges",
    "Practice explaining technical concepts to different audiences (technical vs. non-technical)"
  ]
}

SCORING GUIDELINES:
- 90-100: Exceptional performance, ready for senior roles
- 80-89: Strong performance with minor areas for improvement
- 70-79: Good foundation with some development needed
- 60-69: Adequate but requires focused improvement
- Below 60: Significant development needed before interviewing

Focus on growth potential and specific, actionable advice. Be encouraging but honest about areas needing improvement.`;

    try {
        const response = await provider.generateText(feedbackPrompt);
        const cleanResponse = response.trim();
        
        // Try to parse JSON response
        let feedback: InterviewFeedback;
        try {
            const parsed = JSON.parse(cleanResponse);
            feedback = {
                ...parsed,
                detailedFeedback: generateDetailedFeedback(responses)
            };
        } catch (parseError) {
            // Try to extract JSON from response
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                feedback = {
                    ...parsed,
                    detailedFeedback: generateDetailedFeedback(responses)
                };
            } else {
                throw new Error('Could not parse feedback JSON');
            }
        }

        // Validate scores are within range
        feedback.overallScore = Math.max(0, Math.min(100, feedback.overallScore || 0));
        Object.keys(feedback.categoryScores).forEach(key => {
            const categoryKey = key as keyof typeof feedback.categoryScores;
            feedback.categoryScores[categoryKey] = Math.max(0, Math.min(100, feedback.categoryScores[categoryKey] || 0));
        });

        return feedback;

    } catch (error) {
        console.error('Error parsing AI feedback:', error);
        return generateRuleBasedFeedback(session, responses);
    }
}

function generateRuleBasedFeedback(session: any, responses: any[]): InterviewFeedback {
    const detailedFeedback = generateDetailedFeedback(responses);
    
    // Calculate more nuanced scores based on available data
    const avgVisualScore = detailedFeedback.length > 0 
        ? Math.round(detailedFeedback.reduce((sum, d) => sum + d.visualScore, 0) / detailedFeedback.length)
        : 75;
    
    const avgAudioScore = detailedFeedback.length > 0
        ? Math.round(detailedFeedback.reduce((sum, d) => sum + d.audioScore, 0) / detailedFeedback.length)
        : 78;

    // More sophisticated overall scoring
    const responseQuality = responses.length > 0 ? Math.min(100, responses.length * 20) : 60;
    const completionBonus = responses.length >= 3 ? 10 : 0;
    const overallScore = Math.round((avgVisualScore * 0.3 + avgAudioScore * 0.4 + responseQuality * 0.3) + completionBonus);

    // Enhanced category scoring
    const categoryScores = {
        communication: Math.round(avgAudioScore * 0.8 + (responses.length > 0 ? 15 : 0)),
        technical: session.interview_type === 'technical' 
            ? Math.round(avgAudioScore * 0.9 + (responses.length >= 3 ? 10 : 0))
            : Math.max(65, avgAudioScore - 5),
        confidence: Math.round(avgVisualScore * 0.7 + avgAudioScore * 0.3),
        bodyLanguage: Math.max(60, avgVisualScore - 3)
    };

    // Ensure scores are within bounds
    Object.keys(categoryScores).forEach(key => {
        const categoryKey = key as keyof typeof categoryScores;
        categoryScores[categoryKey] = Math.max(50, Math.min(95, categoryScores[categoryKey]));
    });

    // Generate sophisticated strengths and improvements
    const strengths = [];
    const improvements = [];

    // Strengths based on performance
    if (responses.length >= 3) strengths.push('Completed the full interview session, showing commitment and preparation');
    if (categoryScores.communication > 80) strengths.push('Demonstrated clear and articulate communication throughout responses');
    if (categoryScores.technical > 80) strengths.push('Showed strong technical knowledge and problem-solving approach');
    if (categoryScores.confidence > 80) strengths.push('Maintained confident and professional demeanor during the interview');
    if (categoryScores.bodyLanguage > 80) strengths.push('Exhibited strong professional presence and body language');
    if (overallScore > 85) strengths.push('Overall performance indicates strong interview readiness');

    // Improvements based on gaps
    if (categoryScores.communication < 75) improvements.push('Focus on structuring responses more clearly using frameworks like STAR method');
    if (categoryScores.technical < 75) improvements.push('Strengthen technical explanations with more specific examples and implementation details');
    if (categoryScores.confidence < 75) improvements.push('Practice building confidence through mock interviews and positive self-talk');
    if (categoryScores.bodyLanguage < 75) improvements.push('Work on maintaining eye contact and confident posture throughout responses');
    if (responses.length < 3) improvements.push('Complete full interview sessions to build stamina and consistency');
    if (overallScore < 70) improvements.push('Consider additional practice sessions to improve overall interview performance');

    // Default strengths/improvements if none generated
    if (strengths.length === 0) {
        strengths.push('Showed willingness to practice and improve through mock interviews');
        strengths.push('Demonstrated initiative by completing the interview setup process');
    }
    if (improvements.length === 0) {
        improvements.push('Continue practicing with mock interviews to build confidence and fluency');
        improvements.push('Focus on providing specific examples and measurable outcomes in responses');
    }

    // Enhanced next steps
    const nextSteps = [
        'Practice the STAR method (Situation, Task, Action, Result) for behavioral questions',
        'Prepare 5-7 specific examples that demonstrate key competencies for your target role',
        'Research common interview questions for your field and practice responses out loud',
        'Record yourself answering questions to identify areas for improvement in delivery',
        'Schedule regular mock interview sessions to build confidence and consistency',
        'Prepare thoughtful questions to ask interviewers about the role and company culture'
    ];

    return {
        overallScore: Math.max(55, Math.min(95, overallScore)),
        categoryScores,
        strengths: strengths.slice(0, 4), // Limit to top 4
        improvements: improvements.slice(0, 4), // Limit to top 4
        detailedFeedback,
        nextSteps: nextSteps.slice(0, 5) // Limit to top 5
    };
}

function generateDetailedFeedback(responses: any[]) {
    return responses.map((response: any, idx: number) => {
        const analysisData = response.analysis_data || {};
        const visual = analysisData.visual || { eyeContact: 75, bodyLanguage: 70, confidence: 75 };
        const audio = analysisData.audio || { clarity: 80, pace: 120, fillerWords: 2, volume: 75 };

        const visualScore = Math.round(
            (visual.eyeContact * 0.3) + (visual.bodyLanguage * 0.3) + (visual.confidence * 0.4)
        );

        const audioScore = Math.round(
            (audio.clarity * 0.4) + 
            (Math.min(100, Math.max(0, 100 - Math.abs(audio.pace - 150) * 0.5)) * 0.2) + 
            (audio.volume * 0.2) + 
            (Math.max(0, 100 - audio.fillerWords * 10) * 0.2)
        );

        return {
            questionId: idx + 1,
            visualScore,
            audioScore,
            transcript: response.transcript || 'No transcript available',
            notes: visual.notes || `Response ${idx + 1} analysis`
        };
    });
}