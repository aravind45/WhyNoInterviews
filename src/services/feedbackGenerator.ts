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
  const sessionResult = await query(`SELECT * FROM interview_sessions WHERE id = $1`, [sessionId]);

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
    [sessionId],
  );

  const responses = responsesResult.rows;

  if (responses.length === 0) {
    // Return default feedback if no responses
    return {
      overallScore: 0,
      rubrics: {
        activeListening: {
          score: 0,
          maxScore: 5,
          feedback: 'Pending',
          improvements: 'Pending',
          showInsights: false,
        },
        keyAccomplishments: {
          score: 0,
          maxScore: 5,
          feedback: 'Pending',
          improvements: 'Pending',
          showInsights: false,
        },
        relevantQuestions: {
          score: 0,
          maxScore: 5,
          feedback: 'Pending',
          improvements: 'Pending',
          showInsights: false,
        },
        communication: {
          score: 0,
          maxScore: 5,
          feedback: 'Pending',
          improvements: 'Pending',
          showInsights: false,
        },
        technicalKnowledge: {
          score: 0,
          maxScore: 5,
          feedback: 'Pending',
          improvements: 'Pending',
          showInsights: false,
        },
        problemSolving: {
          score: 0,
          maxScore: 5,
          feedback: 'Pending',
          improvements: 'Pending',
          showInsights: false,
        },
      },
      strengths: [],
      growthAreas: ['Complete the interview to receive feedback'],
      detailedFeedback: [],
      summary: [],
      nextSteps: ['Start recording your responses to get AI-powered feedback'],
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

/**
 * Helper function to count filler words in transcript
 */
function countFillerWords(transcript: string | null): number {
  if (!transcript) return 0;

  const fillers = [
    /\bum\b/gi,
    /\buh\b/gi,
    /\blike\b/gi,
    /\byou know\b/gi,
    /\bsort of\b/gi,
    /\bkind of\b/gi,
    /\bbasically\b/gi,
    /\bactually\b/gi,
  ];

  let count = 0;
  fillers.forEach(pattern => {
    const matches = transcript.match(pattern);
    if (matches) count += matches.length;
  });

  return count;
}

/**
 * Helper function to analyze vocal patterns
 */
function analyzeVocalPatterns(transcript: string | null, durationSeconds: number) {
  if (!transcript || durationSeconds === 0) {
    return {
      wordsPerMinute: 0,
      wordCount: 0,
      fillerWordCount: 0,
      fillerWordPercentage: 0,
      pacingAssessment: 'Unable to assess',
    };
  }

  const words = transcript.trim().split(/\s+/);
  const wordCount = words.length;
  const wordsPerMinute = Math.round((wordCount / durationSeconds) * 60);
  const fillerWordCount = countFillerWords(transcript);
  const fillerWordPercentage = Math.round((fillerWordCount / wordCount) * 100);

  let pacingAssessment = 'Good';
  if (wordsPerMinute < 120) pacingAssessment = 'Too slow';
  else if (wordsPerMinute > 170) pacingAssessment = 'Too fast';

  return {
    wordsPerMinute,
    wordCount,
    fillerWordCount,
    fillerWordPercentage,
    pacingAssessment,
  };
}

/**
 * Helper function to extract key requirements from job description
 */
function extractKeyRequirements(jobDescription: string): string[] {
  // Simple extraction - look for common patterns
  const requirements: string[] = [];

  // Look for years of experience
  const yearsMatch = jobDescription.match(/(\d+)[-+]?\s*years?\s+(?:of\s+)?experience/i);
  if (yearsMatch) requirements.push(`${yearsMatch[1]}+ years of experience`);

  // Look for required skills (technologies, frameworks, etc.)
  const techKeywords = [
    'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Python', 'Java', 'JavaScript',
    'React', 'Node.js', 'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'Redis',
    'LangChain', 'TensorFlow', 'PyTorch', 'Agentic AI', 'GenAI', 'Machine Learning',
    'TOGAF', 'Blockchain', 'Microservices', 'REST API', 'GraphQL',
    'HIPAA', 'GDPR', 'SOX', 'PCI DSS',
  ];

  techKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(jobDescription)) {
      requirements.push(keyword);
    }
  });

  // Look for certifications
  const certMatch = jobDescription.match(/\b(AWS Certified|GCP Professional|TOGAF|PMP|CISSP)\b/gi);
  if (certMatch) requirements.push(...certMatch);

  return [...new Set(requirements)]; // Remove duplicates
}

async function generateAIFeedback(
  session: any,
  responses: any[],
  provider: any,
): Promise<InterviewFeedback> {
  // Analyze each response for vocal patterns
  const responseAnalysis = responses.map((r, i) => {
    const vocalPatterns = analyzeVocalPatterns(r.transcript, r.response_duration_seconds || 0);
    return {
      questionNumber: i + 1,
      questionType: r.question_type,
      questionText: r.question_text,
      duration: r.response_duration_seconds || 0,
      transcript: r.transcript || '',
      ...vocalPatterns,
    };
  });

  // Calculate total filler words across all responses
  const totalFillerWords = responseAnalysis.reduce((sum, r) => sum + r.fillerWordCount, 0);
  const avgWordsPerMinute = responseAnalysis.length > 0
    ? Math.round(responseAnalysis.reduce((sum, r) => sum + r.wordsPerMinute, 0) / responseAnalysis.length)
    : 0;

  const feedbackPrompt = `You are an expert interview coach from LHH (Lee Hecht Harrison) with 15+ years of experience in executive coaching and talent development. Analyze this mock interview performance and provide detailed, structured feedback following professional coaching standards.

INTERVIEW CONTEXT:
- Job Role: ${session.job_role}
- Interview Type: ${session.interview_type}
- Duration: ${session.duration_minutes} minutes
- Number of Responses: ${responses.length}

VOCAL PERFORMANCE METRICS:
- Total Filler Words: ${totalFillerWords} (Target: < 10 for entire interview)
- Average Speaking Rate: ${avgWordsPerMinute} WPM (Optimal: 140-160 WPM)

CANDIDATE RESPONSES WITH ANALYSIS:
${responseAnalysis
      .map(
        (r) => `
QUESTION ${r.questionNumber} (${r.questionType}): ${r.questionText}
Duration: ${r.duration}s (Optimal: 90-150s) ${r.duration > 180 ? '⚠️ TOO LONG' : r.duration < 60 ? '⚠️ TOO SHORT' : '✓'}
Word Count: ${r.wordCount} words
Speaking Rate: ${r.wordsPerMinute} WPM ${r.pacingAssessment !== 'Good' ? `⚠️ ${r.pacingAssessment.toUpperCase()}` : '✓'}
Filler Words: ${r.fillerWordCount} (${r.fillerWordPercentage}% of response) ${r.fillerWordCount > 5 ? '⚠️ HIGH' : '✓'}
Transcript: ${r.transcript || 'No transcript available'}
`,
      )
      .join('\n')}

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

1. RUBRIC SCORES: Provide specific 1-5 scores with detailed, evidence-based feedback
   - Quote actual phrases from the candidate's responses
   - Explain WHY you gave each score with specific examples
   - Compare to what a higher score would look like

2. STRENGTHS: 2-3 specific positive observations with CONCRETE EXAMPLES
   - Quote exact phrases that worked well
   - Explain WHY they were effective
   - Reference specific question numbers
   - Example: "Strong STAR Framework (Q3): Your response about migrating the system showed excellent structure with clear metrics: '95% reduction in login failures'"

3. GROWTH AREAS: 2-4 specific improvement areas with ACTIONABLE ADVICE
   - Identify the specific issue with evidence
   - Provide a BEFORE/AFTER example showing how to improve
   - Include specific practice exercises
   - Example: "Reduce Filler Words (Q1: 8 'um's in 45 seconds): Practice pausing 1-2 seconds instead. Record yourself answering this question 5 times, aiming for < 3 filler words."

4. DETAILED FEEDBACK: Per-question analysis with specific improvements
   - For each question, provide:
     * What worked well (with quotes)
     * What needs improvement (with specific examples)
     * A rewritten "improved version" of a key portion of their response
     * Tone assessment based on actual language used

5. SUMMARY: Key accomplishments and themes from the interview
   - Reference specific examples from responses
   - Identify patterns across multiple questions
   - Connect to role requirements if available

6. NEXT STEPS: 5-6 SPECIFIC, ACTIONABLE recommendations
   - Not generic advice like "practice more"
   - Concrete actions: "Record yourself answering Q1 and Q3, aiming to reduce duration from 4:30 to 2:30"
   - Include measurable goals: "Reduce filler words from ${totalFillerWords} to < 10"
   - Prioritize top 3 improvements that will have biggest impact

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
      "score": 3.5,
      "maxScore": 5,
      "feedback": "Your communication was generally clear and professional. In Q2, you said 'I led a team of 15 engineers to migrate our authentication system,' which was direct and specific. However, filler words reduced clarity - Q1 had 8 'um's in the first 45 seconds.",
      "improvements": "SPECIFIC ISSUE: ${totalFillerWords} filler words total (Target: < 10). Q1 had the most at 8 instances. PRACTICE: Record yourself answering Q1 five times. Each time, pause 1-2 seconds instead of saying 'um.' Goal: Reduce to < 3 filler words. BEFORE: 'So, um, I've been working in, like, enterprise architecture for, um, about 8 years...' AFTER: 'I have 8 years of enterprise architecture experience [PAUSE] most recently at a Fortune 500 insurance company.'",
      "showInsights": true
    },
    "technicalKnowledge": {
      "score": 4,
      "maxScore": 5,
      "feedback": "Strong technical depth! In Q5, you mentioned 'LangChain and Vertex AI for Agentic AI implementation' - directly addressing the job requirement. You explained the agent orchestration pattern clearly, showing practical experience.",
      "improvements": "ADD MORE CONTEXT: When you mentioned LangChain, add WHY you chose it. Example: 'We chose LangChain over Google ADK because it offered better Python integration and had a more mature ecosystem for our use case.' This shows decision-making, not just knowledge.",
      "showInsights": false
    },
    "problemSolving": {
      "score": 3.5,
      "maxScore": 5,
      "feedback": "Good structured thinking in Q4 when you described the migration challenge. You outlined the problem, your approach, and results. The '95% reduction in login failures' metric was excellent.",
      "improvements": "STRENGTHEN FRAMEWORK: Use this structure consistently: 1) Problem identification with metrics, 2) Solution options considered, 3) Decision criteria, 4) Implementation approach, 5) Measurable results. Q3 was missing step 2 (options considered). PRACTICE: Rewrite Q3 response adding: 'We evaluated three approaches: lift-and-shift, refactor, or rebuild. We chose refactor because...'",
      "showInsights": true
    }
  },
  "strengths": [
    "Strong STAR Framework (Q2): Your migration example was excellent - 'When our authentication system hit 10k concurrent users (Situation), I led the migration to OAuth 2.0 (Task), implemented in 3 sprints with zero downtime (Action), reducing login failures by 95% (Result).' This is textbook STAR method with specific metrics.",
    "Technical Depth (Q5): You demonstrated current knowledge by mentioning 'LangChain and Vertex AI for Agentic AI implementation' - directly addressing the job requirement. Your explanation of agent orchestration showed practical, hands-on experience.",
    "Quantifiable Impact (Q2, Q4): You consistently included metrics - '20% cost reduction,' '3-month timeline,' '15-person team.' This makes your accomplishments concrete and credible, setting you apart from candidates who speak in generalities."
  ],
  "growthAreas": [
    "Reduce Filler Words (${totalFillerWords} total, target < 10): Q1 had 8 'um's in 45 seconds. PRACTICE: Record yourself answering Q1 five times, pausing 1-2 seconds instead of saying 'um.' BEFORE: 'So, um, I've been working in, like...' AFTER: 'I have 8 years of enterprise architecture experience [PAUSE] most recently at...'",
    "Tighten Technical Explanations (Q5 ran 4:30, optimal: 2:30): Your Agentic AI explanation was thorough but could be 40% shorter. BEFORE: 'So basically what we did was we looked at different frameworks and we evaluated LangChain and also Google's ADK...' AFTER: 'We evaluated LangChain and Google ADK. We chose LangChain because it offered better integration with our existing Python stack.'",
    "Add Compliance Context (Q4): You mentioned HIPAA once but didn't explain HOW you ensured compliance. ADD: 'We implemented field-level encryption for PHI, conducted quarterly audits, and maintained detailed access logs per HIPAA requirements.' This shows depth beyond just knowing the acronym.",
    "Improve Pacing (Q1: ${responseAnalysis[0]?.wordsPerMinute || 0} WPM, Q3: ${responseAnalysis[2]?.wordsPerMinute || 0} WPM): Optimal is 140-160 WPM. ${responseAnalysis[0]?.wordsPerMinute > 160 ? 'Slow down in Q1 by 10%' : responseAnalysis[0]?.wordsPerMinute < 140 ? 'Speed up slightly in Q1' : 'Good pacing in Q1'}. Practice with a metronome or timer to maintain consistent pace."
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
    "PRIORITY 1 - Reduce Filler Words (This Week): Record yourself answering Q1 and Q3 five times each. Count filler words in each attempt. Goal: Reduce from ${totalFillerWords} total to < 10 in your next mock interview. Practice pausing 1-2 seconds instead of saying 'um.'",
    "PRIORITY 2 - Tighten Long Responses (Next 3 Days): Q5 ran 4:30 (optimal: 2:30). Rewrite your Q5 response to be 40% shorter while keeping all key points. Practice delivering it in under 2:30. Use the formula: Problem → Solution → Impact.",
    "PRIORITY 3 - Add Compliance Details (Tomorrow): For Q4, prepare a 30-second addition explaining HOW you ensured HIPAA compliance: 'We implemented field-level encryption for PHI, conducted quarterly audits, and maintained detailed access logs.' Practice adding this naturally.",
    "Prepare 7 STAR Stories (Next Week): Write out 7 complete STAR examples covering: Leadership, Technical Problem, Conflict, Failure, Innovation, Cross-functional Collaboration, Measurable Impact. Each should be deliverable in 90-120 seconds.",
    "Practice Pacing (Daily - 10 min): Read technical articles aloud at 150 WPM (use a timer). This will help you maintain optimal pacing. Your current average is ${avgWordsPerMinute} WPM.",
    "Schedule 2 More Mock Interviews (Next 2 Weeks): Practice with different interviewers. Request specific feedback on filler words and pacing. Aim for 85+ overall score and < 10 total filler words."
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
    const rubricKeys = [
      'activeListening',
      'keyAccomplishments',
      'relevantQuestions',
      'communication',
      'technicalKnowledge',
      'problemSolving',
    ] as const;
    rubricKeys.forEach((key) => {
      if (!feedback.rubrics[key]) {
        feedback.rubrics[key] = {
          score: 3,
          maxScore: 5,
          feedback: 'Assessment pending - complete more responses for detailed feedback.',
          improvements: 'Continue practicing to receive specific improvement recommendations.',
          showInsights: false,
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
  const hasTranscripts = responses.some((r) => r.transcript && r.transcript.length > 10);

  // Calculate base scores (1-5 scale)
  const baseScore = Math.min(5, Math.max(1, 2 + responseCount * 0.5));
  const completionBonus = responseCount >= 3 ? 0.5 : 0;

  // Generate rubric scores
  const rubrics = {
    activeListening: {
      score: Math.min(5, Math.round(baseScore + (hasTranscripts ? 0.5 : 0))),
      maxScore: 5,
      feedback:
        responseCount > 0
          ? 'You demonstrated engagement by completing interview responses. This shows attention to the process and willingness to participate fully.'
          : 'Complete more interview responses to demonstrate active listening and engagement with the questions.',
      improvements:
        responseCount >= 3
          ? "To improve active listening, practice acknowledging the interviewer's questions more explicitly and ask clarifying questions when needed."
          : 'Focus on completing full responses to each question to show active engagement with the interview process.',
      showInsights: responseCount >= 2,
    },
    keyAccomplishments: {
      score: Math.min(5, Math.round(baseScore + completionBonus)),
      maxScore: 5,
      feedback:
        responseCount >= 2
          ? 'You provided examples during your responses, showing effort to share relevant experiences and accomplishments.'
          : 'Work on sharing specific examples that demonstrate your key accomplishments and impact.',
      improvements:
        'Structure your examples using the STAR method (Situation, Task, Action, Result) and include specific metrics and outcomes where possible.',
      showInsights: responseCount >= 3,
    },
    relevantQuestions: {
      score: Math.min(5, Math.round(baseScore)),
      maxScore: 5,
      feedback:
        'Asking thoughtful questions shows preparation and genuine interest in the role and company.',
      improvements:
        'Prepare 3-5 specific questions about the role, team dynamics, and company culture to ask during interviews.',
      showInsights: false,
    },
    communication: {
      score: Math.min(5, Math.round(baseScore + (hasTranscripts ? 0.3 : 0))),
      maxScore: 5,
      feedback: hasTranscripts
        ? 'Your responses showed clear communication and professional tone. You articulated your thoughts in a structured manner.'
        : 'Focus on clear articulation and professional communication in your responses.',
      improvements:
        'Practice reducing filler words and maintaining consistent pace and volume throughout your responses.',
      showInsights: hasTranscripts,
    },
    technicalKnowledge: {
      score:
        session.interview_type === 'technical'
          ? Math.min(5, Math.round(baseScore + 0.5))
          : Math.min(5, Math.round(baseScore)),
      maxScore: 5,
      feedback:
        session.interview_type === 'technical'
          ? 'You engaged with technical questions, showing willingness to discuss your technical background and experience.'
          : 'Consider how to effectively communicate your technical knowledge and problem-solving approach.',
      improvements:
        'Prepare specific examples that demonstrate your technical expertise and explain complex concepts clearly.',
      showInsights: session.interview_type === 'technical',
    },
    problemSolving: {
      score: Math.min(5, Math.round(baseScore + (responseCount >= 3 ? 0.4 : 0))),
      maxScore: 5,
      feedback:
        responseCount >= 2
          ? 'You approached the interview questions systematically, showing structured thinking in your responses.'
          : 'Demonstrate your problem-solving approach by working through examples step-by-step.',
      improvements:
        'Use a consistent framework for problem-solving: identify the problem, explore options, explain your decision process, and describe results.',
      showInsights: responseCount >= 3,
    },
  };

  // Calculate overall score (convert 1-5 to 0-100 scale)
  const avgRubricScore = Object.values(rubrics).reduce((sum, rubric) => sum + rubric.score, 0) / 6;
  const overallScore = Math.round((avgRubricScore - 1) * 25); // Convert 1-5 to 0-100

  // Generate strengths based on performance
  const strengths = [];
  if (responseCount >= 3)
    strengths.push(
      'Completed the full interview session, demonstrating commitment and follow-through.',
    );
  if (rubrics.communication.score >= 4)
    strengths.push('Showed clear and professional communication throughout your responses.');
  if (rubrics.technicalKnowledge.score >= 4)
    strengths.push('Demonstrated relevant technical knowledge and practical experience.');
  if (hasTranscripts)
    strengths.push('Provided substantive responses that showed preparation and thoughtfulness.');
  if (overallScore >= 75)
    strengths.push(
      'Overall performance indicates strong interview readiness and professional presence.',
    );

  // Default strengths if none generated
  if (strengths.length === 0) {
    strengths.push('Showed initiative by participating in mock interview practice.');
    strengths.push('Demonstrated willingness to improve through structured feedback and coaching.');
  }

  // Generate growth areas
  const growthAreas = [];
  if (rubrics.activeListening.score < 4)
    growthAreas.push(
      "Focus on demonstrating active listening by asking clarifying questions and building on the interviewer's comments.",
    );
  if (rubrics.keyAccomplishments.score < 4)
    growthAreas.push(
      'Strengthen your examples by using the STAR method and including specific, measurable outcomes.',
    );
  if (rubrics.communication.score < 4)
    growthAreas.push(
      'Work on clarity and conciseness in your responses, reducing filler words and maintaining professional tone.',
    );
  if (rubrics.problemSolving.score < 4)
    growthAreas.push(
      'Develop a more systematic approach to explaining your problem-solving process and decision-making.',
    );
  if (responseCount < 3)
    growthAreas.push(
      'Complete full interview sessions to build stamina and consistency in your performance.',
    );

  // Default growth areas if none generated
  if (growthAreas.length === 0) {
    growthAreas.push(
      'Continue practicing with mock interviews to build confidence and fluency in your responses.',
    );
    growthAreas.push(
      'Focus on providing more specific examples with quantifiable results and clear impact statements.',
    );
  }

  // Generate detailed feedback for each response
  const detailedFeedback: DetailedFeedback[] = responses.map((response, idx) => ({
    questionNumber: idx + 1,
    questionText: response.question_text || `Question ${idx + 1}`,
    response: response.transcript || 'Response recorded',
    feedback: `Your response showed engagement with the question. ${hasTranscripts ? 'Consider structuring your answer more clearly and including specific examples.' : 'Focus on providing clear, structured responses with concrete examples.'}`,
    tone: {
      professional: Math.min(100, 70 + responseCount * 5),
      clear: Math.min(100, 65 + (hasTranscripts ? 15 : 5)),
      relaxed: Math.min(100, 60 + responseCount * 8),
      confident: Math.min(100, 55 + responseCount * 10),
    },
    conciseness: hasTranscripts
      ? {
        timestamp: '0:30',
        originalText: 'Sample of original response text...',
        improvedText: 'More concise version of the response...',
        explanation:
          'This revision removes redundancy and focuses on key points for greater impact.',
      }
      : undefined,
  }));

  // Generate summary points
  const summary = [
    `Completed ${responseCount} interview response${responseCount !== 1 ? 's' : ''}, showing engagement with the mock interview process.`,
    responseCount >= 3
      ? 'Demonstrated consistency and stamina by completing the full interview session.'
      : 'Building interview endurance through continued practice sessions.',
    hasTranscripts
      ? 'Provided substantive responses that showed preparation and relevant experience.'
      : 'Focus on developing more detailed responses with specific examples and outcomes.',
    session.interview_type === 'technical'
      ? 'Engaged with technical questions, showing willingness to discuss technical background.'
      : 'Demonstrated professional communication appropriate for the interview context.',
  ];

  // Generate next steps
  const nextSteps = [
    'Practice the STAR method (Situation, Task, Action, Result) with 5-7 prepared examples covering key competencies.',
    'Record yourself answering common interview questions to identify areas for improvement in delivery and pacing.',
    'Prepare specific, thoughtful questions to ask interviewers about the role, team, and company culture.',
    "Work on reducing filler words by practicing pausing briefly instead of using 'um' or 'uh' when thinking.",
    'Schedule regular mock interview sessions to build confidence and consistency in your performance.',
    'Research the company and role thoroughly before each interview to demonstrate genuine interest and preparation.',
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
        "Practice words like 'eventually' with stress on the second syllable: /ɪˈvɛntʃuəli/.",
      ],
      consonantClusters: [
        'Pay attention to consonant clusters at word endings, especially before words starting with consonants.',
        "Practice clear articulation in phrases like 'past projects' and 'next steps' to improve speech precision.",
      ],
    },
    nextSteps: nextSteps.slice(0, 6),
  };
}
