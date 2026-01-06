// src/services/feedbackGenerator.ts
import { query } from '../database/connection';
import { getProvider, getDefaultProvider } from './llmProvider';

export interface RubricScore {
    score: number; // 1-5 scale
    maxScore: number; // Always 5
    feedback: string;
    improvements: string;
    showInsights?: boolean;
}

export interface DetailedFeedback {
    questionNumber: number;
    questionText: string;
    response: string;
    feedback: string;
    tone: {
        professional: number;
        clear: number;
        relaxed: number;
        confident: number;
    };
    conciseness?: {
        timestamp: string;
        originalText: string;
        improvedText: string;
        explanation: string;
    };
}

export interface InterviewFeedback {
    overallScore: number;
    rubrics: {
        activeListening: RubricScore;
        keyAccomplishments: RubricScore;
        relevantQuestions: RubricScore;
        communication: RubricScore;
        technicalKnowledge: RubricScore;
        problemSolving: RubricScore;
    };
    strengths: string[];
    growthAreas: string[];
    detailedFeedback: DetailedFeedback[];
    summary: string[];
    pronunciation?: {
        syllableStress: string[];
        consonantClusters: string[];
    };
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
            rubrics: {
                activeListening: { score: 0, maxScore: 5, feedback: 'Pending', improvements: 'Pending', showInsights: false },
                keyAccomplishments: { score: 0, maxScore: 5, feedback: 'Pending', improvements: 'Pending', showInsights: false },
                relevantQuestions: { score: 0, maxScore: 5, feedback: 'Pending', improvements: 'Pending', showInsights: false },
                communication: { score: 0, maxScore: 5, feedback: 'Pending', improvements: 'Pending', showInsights: false },
                technicalKnowledge: { score: 0, maxScore: 5, feedback: 'Pending', improvements: 'Pending', showInsights: false },
                problemSolving: { score: 0, maxScore: 5, feedback: 'Pending', improvements: 'Pending', showInsights: false }
            },
            strengths: [],
            growthAreas: ['Complete the interview to receive feedback'],
            detailedFeedback: [],
            summary: [],
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
    const feedbackPrompt = `You are an expert interview coach from LHH (Lee Hecht Harrison) with 15+ years of experience in executive coaching and talent development. Analyze this mock interview performance and provide detailed, structured feedback following professional coaching standards.

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
`).join('\n')}

EVALUATION FRAMEWORK - Use 1-5 scale for each rubric:

ACTIVE LISTENING (1-5):
- Demonstrates engagement with interviewer's questions
- Asks clarifying questions when needed
- Builds on interviewer's comments
- Shows understanding through responses

KEY ACCOMPLISHMENTS (1-5):
- Uses structured storytelling (STAR method)
- Provides specific, measurable examples
- Demonstrates clear impact and results
- Includes relevant metrics and timelines

RELEVANT QUESTIONS (1-5):
- Asks thoughtful, role-specific questions
- Shows research and preparation
- Demonstrates genuine interest
- Engages throughout the conversation

COMMUNICATION (1-5):
- Clear articulation and professional tone
- Appropriate pace and volume
- Minimal filler words
- Confident delivery

TECHNICAL KNOWLEDGE (1-5):
- Demonstrates relevant expertise
- Explains concepts clearly
- Shows current industry awareness
- Provides practical examples

PROBLEM SOLVING (1-5):
- Structured approach to challenges
- Creative and practical solutions
- Shows analytical thinking
- Learns from past experiences

FEEDBACK STRUCTURE REQUIREMENTS:

1. RUBRIC SCORES: Provide specific 1-5 scores with detailed feedback
2. STRENGTHS: 2-3 specific positive observations with examples
3. GROWTH AREAS: 2-4 specific improvement areas with actionable advice
4. DETAILED FEEDBACK: Per-question analysis with tone assessment
5. SUMMARY: Key accomplishments and themes from the interview
6. NEXT STEPS: 5-6 specific, actionable recommendations

Return feedback in this exact JSON format:
{
  "overallScore": 75,
  "rubrics": {
    "activeListening": {
      "score": 3,
      "maxScore": 5,
      "feedback": "You demonstrated some good active listening skills, particularly when you asked for clarification about specific requirements, showing you were paying attention and wanted to fully understand the question.",
      "improvements": "To improve your active listening, try to acknowledge and build on your conversation partner's comments more often. For example, when the interviewer mentions a challenge, you could respond with 'That's an interesting point about X - I've seen similar situations where Y approach worked well. How has your team typically handled this?'",
      "showInsights": true
    },
    "keyAccomplishments": {
      "score": 4,
      "maxScore": 5,
      "feedback": "You did well in sharing key accomplishments that demonstrate your impact through structured storytelling. Your examples showed clear situation-action-result frameworks with specific challenges and measurable outcomes.",
      "improvements": "To strengthen future responses, consider including more specific metrics and timelines, and work on being more concise while maintaining the strong structural elements you already demonstrate well.",
      "showInsights": false
    },
    "relevantQuestions": {
      "score": 4,
      "maxScore": 5,
      "feedback": "You did well at asking relevant questions, particularly about team structure and role expectations. Your questions showed good preparation and genuine interest in the position.",
      "improvements": "Consider asking follow-up questions throughout the conversation, not just at the end, to demonstrate continuous engagement and deepen the discussion about specific examples you're sharing.",
      "showInsights": false
    },
    "communication": {
      "score": 3,
      "maxScore": 5,
      "feedback": "Your communication was generally clear and professional, with good structure in your responses. You presented information in a logical flow that was easy to follow.",
      "improvements": "Work on reducing filler words and varying your vocal tone to project more confidence. Practice pausing briefly instead of using 'um' or 'uh' when collecting your thoughts.",
      "showInsights": true
    },
    "technicalKnowledge": {
      "score": 4,
      "maxScore": 5,
      "feedback": "You demonstrated strong technical knowledge with relevant examples and current industry awareness. Your explanations were clear and showed practical experience.",
      "improvements": "Consider providing more specific technical details when explaining implementation decisions, and relate your technical knowledge more directly to the role requirements.",
      "showInsights": false
    },
    "problemSolving": {
      "score": 3,
      "maxScore": 5,
      "feedback": "You showed good problem-solving approach with structured thinking and practical solutions. Your examples demonstrated analytical skills and learning from experience.",
      "improvements": "Focus on presenting a more systematic problem-solving framework. Start with problem identification, then solution options, decision criteria, and measurable outcomes.",
      "showInsights": true
    }
  },
  "strengths": [
    "You shared a variety of strong examples showcasing your leadership abilities and creative problem-solving. Nice job!",
    "Demonstrated excellent use of the STAR method in your project management examples, providing clear context and measurable results.",
    "Showed strong self-awareness and ability to learn from challenging situations, particularly in your conflict resolution example."
  ],
  "growthAreas": [
    "Prioritize clarity and conciseness: Many of your answers could be more succinct. Focus on key takeaways and avoid unnecessary repetition to make your responses more impactful.",
    "Engage with the interviewer by asking follow-up questions: Create more interactive dialogue throughout the conversation to demonstrate active listening and deeper engagement.",
    "Use quantifiable impact wherever possible: Include specific metrics and measurable outcomes in your examples to make them more concrete and compelling.",
    "Frame complex stories with clearer structure: Use intentional frameworks like STAR method consistently to make your responses easier to follow and more impactful."
  ],
  "detailedFeedback": [
    {
      "questionNumber": 1,
      "questionText": "Tell me about yourself",
      "response": "Brief summary of response...",
      "feedback": "Good job on expressing gratitude for the opportunity. Your response was polite and showed a positive attitude, which is a great way to start the interview. Consider elaborating slightly on how you are feeling to make your response more engaging and personable.",
      "tone": {
        "professional": 85,
        "clear": 80,
        "relaxed": 75,
        "confident": 70
      }
    }
  ],
  "summary": [
    "The candidate managed multiple complex projects with specific challenges, demonstrating strong leadership and coordination skills across business units.",
    "They effectively handled conflicts and adapted to unforeseen situations, displaying emphasis on team well-being and delivery management.",
    "Demonstrated strong empathy and leadership by addressing team performance issues with mentorship and support.",
    "Showed ability to identify risks early and maintain transparency with stakeholders while adapting project timelines."
  ],
  "pronunciation": {
    "syllableStress": [
      "Focus on syllable stress in business words. The noun 'project' is stressed on the first syllable: /ˈprɑːdʒɛkt/, with emphasis on 'PRO'.",
      "The word 'eventually' has stress on the second syllable: /ɪˈvɛntʃuəli/, with emphasis on 'VEN'."
    ],
    "consonantClusters": [
      "Pay attention to fully pronouncing consonant clusters at word ends. In 'sprints planning', make the final /s/ in 'sprints' clear before 'planning'.",
      "In 'past pain points', articulate the /t/ sound in 'past' clearly: /pæst peɪn pɔɪnts/."
    ]
  },
  "nextSteps": [
    "Practice the STAR method with 3-5 prepared stories covering different competencies relevant to your target role",
    "Work on reducing filler words by recording yourself and practicing pausing instead of using 'um' or 'uh'",
    "Prepare specific questions about team dynamics, technical challenges, and growth opportunities for each interview",
    "Practice explaining technical concepts concisely while including specific metrics and outcomes",
    "Develop a systematic approach to discussing problem-solving: problem identification → solution options → decision criteria → results",
    "Schedule regular mock interviews to build confidence and consistency in your delivery"
  ]
}

SCORING GUIDELINES:
- 5: Exceptional - Exceeds expectations, ready for senior roles
- 4: Proficient - Meets expectations with minor areas for improvement  
- 3: Developing - Good foundation, some development needed
- 2: Needs Improvement - Adequate but requires focused work
- 1: Inadequate - Significant development needed

Focus on specific, actionable feedback with examples from their actual responses. Be encouraging but honest about areas needing improvement.`;

    try {
        const response = await provider.generateText(feedbackPrompt);
        const cleanResponse = response.trim();

        // Try to parse JSON response
        let feedback: InterviewFeedback;
        try {
            feedback = JSON.parse(cleanResponse);
        } catch (parseError) {
            // Try to extract JSON from response
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                feedback = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse feedback JSON');
            }
        }

        // Validate and ensure proper structure
        feedback.overallScore = Math.max(0, Math.min(100, feedback.overallScore || 0));

        // Ensure all rubrics have proper structure
        const rubricKeys = ['activeListening', 'keyAccomplishments', 'relevantQuestions', 'communication', 'technicalKnowledge', 'problemSolving'] as const;
        rubricKeys.forEach(key => {
            if (!feedback.rubrics[key]) {
                feedback.rubrics[key] = {
                    score: 3,
                    maxScore: 5,
                    feedback: 'Assessment pending - complete more responses for detailed feedback.',
                    improvements: 'Continue practicing to receive specific improvement recommendations.',
                    showInsights: false
                };
            }
            // Ensure scores are 1-5
            feedback.rubrics[key].score = Math.max(1, Math.min(5, feedback.rubrics[key].score || 3));
            feedback.rubrics[key].maxScore = 5;
        });

        return feedback;

    } catch (error) {
        console.error('Error parsing AI feedback:', error);
        return generateRuleBasedFeedback(session, responses);
    }
}

function generateRuleBasedFeedback(session: any, responses: any[]): InterviewFeedback {
    const responseCount = responses.length;
    const hasTranscripts = responses.some(r => r.transcript && r.transcript.length > 10);

    // Calculate base scores (1-5 scale)
    const baseScore = Math.min(5, Math.max(1, 2 + (responseCount * 0.5)));
    const completionBonus = responseCount >= 3 ? 0.5 : 0;

    // Generate rubric scores
    const rubrics = {
        activeListening: {
            score: Math.min(5, Math.round(baseScore + (hasTranscripts ? 0.5 : 0))),
            maxScore: 5,
            feedback: responseCount > 0
                ? "You demonstrated engagement by completing interview responses. This shows attention to the process and willingness to participate fully."
                : "Complete more interview responses to demonstrate active listening and engagement with the questions.",
            improvements: responseCount >= 3
                ? "To improve active listening, practice acknowledging the interviewer's questions more explicitly and ask clarifying questions when needed."
                : "Focus on completing full responses to each question to show active engagement with the interview process.",
            showInsights: responseCount >= 2
        },
        keyAccomplishments: {
            score: Math.min(5, Math.round(baseScore + completionBonus)),
            maxScore: 5,
            feedback: responseCount >= 2
                ? "You provided examples during your responses, showing effort to share relevant experiences and accomplishments."
                : "Work on sharing specific examples that demonstrate your key accomplishments and impact.",
            improvements: "Structure your examples using the STAR method (Situation, Task, Action, Result) and include specific metrics and outcomes where possible.",
            showInsights: responseCount >= 3
        },
        relevantQuestions: {
            score: Math.min(5, Math.round(baseScore)),
            maxScore: 5,
            feedback: "Asking thoughtful questions shows preparation and genuine interest in the role and company.",
            improvements: "Prepare 3-5 specific questions about the role, team dynamics, and company culture to ask during interviews.",
            showInsights: false
        },
        communication: {
            score: Math.min(5, Math.round(baseScore + (hasTranscripts ? 0.3 : 0))),
            maxScore: 5,
            feedback: hasTranscripts
                ? "Your responses showed clear communication and professional tone. You articulated your thoughts in a structured manner."
                : "Focus on clear articulation and professional communication in your responses.",
            improvements: "Practice reducing filler words and maintaining consistent pace and volume throughout your responses.",
            showInsights: hasTranscripts
        },
        technicalKnowledge: {
            score: session.interview_type === 'technical'
                ? Math.min(5, Math.round(baseScore + 0.5))
                : Math.min(5, Math.round(baseScore)),
            maxScore: 5,
            feedback: session.interview_type === 'technical'
                ? "You engaged with technical questions, showing willingness to discuss your technical background and experience."
                : "Consider how to effectively communicate your technical knowledge and problem-solving approach.",
            improvements: "Prepare specific examples that demonstrate your technical expertise and explain complex concepts clearly.",
            showInsights: session.interview_type === 'technical'
        },
        problemSolving: {
            score: Math.min(5, Math.round(baseScore + (responseCount >= 3 ? 0.4 : 0))),
            maxScore: 5,
            feedback: responseCount >= 2
                ? "You approached the interview questions systematically, showing structured thinking in your responses."
                : "Demonstrate your problem-solving approach by working through examples step-by-step.",
            improvements: "Use a consistent framework for problem-solving: identify the problem, explore options, explain your decision process, and describe results.",
            showInsights: responseCount >= 3
        }
    };

    // Calculate overall score (convert 1-5 to 0-100 scale)
    const avgRubricScore = Object.values(rubrics).reduce((sum, rubric) => sum + rubric.score, 0) / 6;
    const overallScore = Math.round((avgRubricScore - 1) * 25); // Convert 1-5 to 0-100

    // Generate strengths based on performance
    const strengths = [];
    if (responseCount >= 3) strengths.push("Completed the full interview session, demonstrating commitment and follow-through.");
    if (rubrics.communication.score >= 4) strengths.push("Showed clear and professional communication throughout your responses.");
    if (rubrics.technicalKnowledge.score >= 4) strengths.push("Demonstrated relevant technical knowledge and practical experience.");
    if (hasTranscripts) strengths.push("Provided substantive responses that showed preparation and thoughtfulness.");
    if (overallScore >= 75) strengths.push("Overall performance indicates strong interview readiness and professional presence.");

    // Default strengths if none generated
    if (strengths.length === 0) {
        strengths.push("Showed initiative by participating in mock interview practice.");
        strengths.push("Demonstrated willingness to improve through structured feedback and coaching.");
    }

    // Generate growth areas
    const growthAreas = [];
    if (rubrics.activeListening.score < 4) growthAreas.push("Focus on demonstrating active listening by asking clarifying questions and building on the interviewer's comments.");
    if (rubrics.keyAccomplishments.score < 4) growthAreas.push("Strengthen your examples by using the STAR method and including specific, measurable outcomes.");
    if (rubrics.communication.score < 4) growthAreas.push("Work on clarity and conciseness in your responses, reducing filler words and maintaining professional tone.");
    if (rubrics.problemSolving.score < 4) growthAreas.push("Develop a more systematic approach to explaining your problem-solving process and decision-making.");
    if (responseCount < 3) growthAreas.push("Complete full interview sessions to build stamina and consistency in your performance.");

    // Default growth areas if none generated
    if (growthAreas.length === 0) {
        growthAreas.push("Continue practicing with mock interviews to build confidence and fluency in your responses.");
        growthAreas.push("Focus on providing more specific examples with quantifiable results and clear impact statements.");
    }

    // Generate detailed feedback for each response
    const detailedFeedback: DetailedFeedback[] = responses.map((response, idx) => ({
        questionNumber: idx + 1,
        questionText: response.question_text || `Question ${idx + 1}`,
        response: response.transcript || 'Response recorded',
        feedback: `Your response showed engagement with the question. ${hasTranscripts ? 'Consider structuring your answer more clearly and including specific examples.' : 'Focus on providing clear, structured responses with concrete examples.'}`,
        tone: {
            professional: Math.min(100, 70 + (responseCount * 5)),
            clear: Math.min(100, 65 + (hasTranscripts ? 15 : 5)),
            relaxed: Math.min(100, 60 + (responseCount * 8)),
            confident: Math.min(100, 55 + (responseCount * 10))
        },
        conciseness: hasTranscripts ? {
            timestamp: '0:30',
            originalText: 'Sample of original response text...',
            improvedText: 'More concise version of the response...',
            explanation: 'This revision removes redundancy and focuses on key points for greater impact.'
        } : undefined
    }));

    // Generate summary points
    const summary = [
        `Completed ${responseCount} interview response${responseCount !== 1 ? 's' : ''}, showing engagement with the mock interview process.`,
        responseCount >= 3
            ? "Demonstrated consistency and stamina by completing the full interview session."
            : "Building interview endurance through continued practice sessions.",
        hasTranscripts
            ? "Provided substantive responses that showed preparation and relevant experience."
            : "Focus on developing more detailed responses with specific examples and outcomes.",
        session.interview_type === 'technical'
            ? "Engaged with technical questions, showing willingness to discuss technical background."
            : "Demonstrated professional communication appropriate for the interview context."
    ];

    // Generate next steps
    const nextSteps = [
        "Practice the STAR method (Situation, Task, Action, Result) with 5-7 prepared examples covering key competencies.",
        "Record yourself answering common interview questions to identify areas for improvement in delivery and pacing.",
        "Prepare specific, thoughtful questions to ask interviewers about the role, team, and company culture.",
        "Work on reducing filler words by practicing pausing briefly instead of using 'um' or 'uh' when thinking.",
        "Schedule regular mock interview sessions to build confidence and consistency in your performance.",
        "Research the company and role thoroughly before each interview to demonstrate genuine interest and preparation."
    ];

    return {
        overallScore: Math.max(20, Math.min(95, overallScore)),
        rubrics,
        strengths: strengths.slice(0, 3),
        growthAreas: growthAreas.slice(0, 4),
        detailedFeedback,
        summary,
        pronunciation: {
            syllableStress: [
                "Focus on syllable stress in common business words. For example, 'project' (noun) is stressed on the first syllable: /ˈprɑːdʒɛkt/.",
                "Practice words like 'eventually' with stress on the second syllable: /ɪˈvɛntʃuəli/."
            ],
            consonantClusters: [
                "Pay attention to consonant clusters at word endings, especially before words starting with consonants.",
                "Practice clear articulation in phrases like 'past projects' and 'next steps' to improve speech precision."
            ]
        },
        nextSteps: nextSteps.slice(0, 6)
    };
}

