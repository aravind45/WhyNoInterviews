// src/services/questionGenerator.ts
import { getProvider, getDefaultProvider, LLMProvider } from './llmProvider';

export interface QuestionGenerationParams {
  jobRole: string;
  interviewType: string;
  experienceLevel: string;
  duration: number; // minutes
  jobDescription?: string;
}

export interface InterviewQuestion {
  id: number;
  text: string;
  type: string;
  expectedDuration: number;
}

/**
 * Generates interview questions using the provided LLM provider.
 */
export async function generateInterviewQuestions(
  params: QuestionGenerationParams,
  providerName?: LLMProvider,
): Promise<InterviewQuestion[]> {
  const provider = getProvider(providerName || getDefaultProvider());

  const questionCount = Math.max(3, Math.min(10, Math.floor(params.duration / 3)));

  // Try to use LLM provider if available, otherwise go straight to fallback
  if (provider.isAvailable()) {
    const prompt = `You are an experienced technical interviewer. Generate ${questionCount} realistic ${params.interviewType} interview questions for a ${params.jobRole} position.

CONTEXT:
- Job Role: ${params.jobRole}
- Interview Type: ${params.interviewType}
- Experience Level: ${params.experienceLevel}
- Interview Duration: ${params.duration} minutes
${params.jobDescription ? `- Job Description: ${params.jobDescription}` : ''}

QUESTION REQUIREMENTS:

KEEP QUESTIONS CONCISE AND CONVERSATIONAL:
- Maximum 1-2 sentences per question
- Ask ONE thing at a time, not multiple sub-questions
- Use natural, conversational language
- Focus on a single concept or scenario
- Avoid compound questions with multiple parts

For TECHNICAL questions:
- Ask about specific technologies, problem-solving approaches, or design decisions
- Focus on practical experience rather than theoretical knowledge
- Examples: "How would you optimize a slow database query?" or "Explain how you'd design a REST API for user authentication"

For BEHAVIORAL questions:
- Use simple STAR method prompts
- Ask about specific situations or experiences
- Examples: "Tell me about a time you had to work with a difficult team member" or "Describe a project you're particularly proud of"

For MIXED questions:
- Combine technical knowledge with soft skills naturally
- Examples: "How do you explain technical concepts to non-technical stakeholders?" or "Tell me about a time you had to learn a new technology quickly"

EXPERIENCE LEVEL ADJUSTMENTS:
- Entry/Junior: Focus on learning, fundamentals, and potential
- Mid: Problem-solving, collaboration, and technical depth
- Senior: Leadership, architecture, and mentoring
- Lead/Principal: Strategy, influence, and organizational impact

Return ONLY a JSON array with this exact format:
[
  {
    "id": 1,
    "text": "Single, concise question that an interviewer would actually ask",
    "type": "${params.interviewType}",
    "expectedDuration": 180
  }
]

Make questions sound natural and conversational, like a real interviewer would ask them.`;

    try {
      const response = await provider.generateText(prompt);

      // Try to parse the JSON response
      const cleanResponse = response.trim();
      let questions: InterviewQuestion[];

      try {
        questions = JSON.parse(cleanResponse);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse questions from LLM response');
        }
      }

      // Validate and ensure we have the right structure
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions format from LLM');
      }

      // Ensure each question has required fields
      return questions.map((q, index) => ({
        id: q.id || index + 1,
        text: q.text || `${params.interviewType} question ${index + 1} for ${params.jobRole}`,
        type: q.type || params.interviewType,
        expectedDuration: q.expectedDuration || 240,
      }));
    } catch (error) {
      console.error('Error generating questions with LLM:', error);
      // Fall through to fallback questions
    }
  }

  // Fallback to concise, realistic questions if LLM fails or is unavailable
  console.log('Using fallback questions (LLM not available or failed)');
  const fallbackQuestions: InterviewQuestion[] = [];

  if (params.interviewType === 'technical') {
    const technicalQuestions = [
      {
        id: 1,
        text: `How would you optimize a slow database query?`,
        type: 'technical',
        expectedDuration: 180,
      },
      {
        id: 2,
        text: `Explain the difference between REST and GraphQL APIs.`,
        type: 'technical',
        expectedDuration: 180,
      },
      {
        id: 3,
        text: `How do you handle errors in your code?`,
        type: 'technical',
        expectedDuration: 180,
      },
      {
        id: 4,
        text: `What's your approach to code testing?`,
        type: 'technical',
        expectedDuration: 180,
      },
      {
        id: 5,
        text: `How would you design a user authentication system?`,
        type: 'technical',
        expectedDuration: 240,
      },
      {
        id: 6,
        text: `What tools do you use for debugging?`,
        type: 'technical',
        expectedDuration: 120,
      },
    ];
    fallbackQuestions.push(...technicalQuestions);
  } else if (params.interviewType === 'behavioral') {
    const behavioralQuestions = [
      {
        id: 1,
        text: `Tell me about a time you disagreed with a team member.`,
        type: 'behavioral',
        expectedDuration: 180,
      },
      {
        id: 2,
        text: `Describe a project you're particularly proud of.`,
        type: 'behavioral',
        expectedDuration: 180,
      },
      {
        id: 3,
        text: `How do you handle tight deadlines?`,
        type: 'behavioral',
        expectedDuration: 180,
      },
      {
        id: 4,
        text: `Tell me about a mistake you made and how you handled it.`,
        type: 'behavioral',
        expectedDuration: 180,
      },
      {
        id: 5,
        text: `Describe a time you had to learn something new quickly.`,
        type: 'behavioral',
        expectedDuration: 180,
      },
      {
        id: 6,
        text: `How do you prioritize your work when everything seems urgent?`,
        type: 'behavioral',
        expectedDuration: 180,
      },
    ];
    fallbackQuestions.push(...behavioralQuestions);
  } else {
    // Mixed questions combining technical and behavioral aspects
    const mixedQuestions = [
      {
        id: 1,
        text: `Tell me about your background and why you're interested in this role.`,
        type: 'behavioral',
        expectedDuration: 180,
      },
      {
        id: 2,
        text: `How do you explain technical concepts to non-technical people?`,
        type: 'behavioral',
        expectedDuration: 180,
      },
      {
        id: 3,
        text: `What's your experience with code reviews?`,
        type: 'technical',
        expectedDuration: 180,
      },
      {
        id: 4,
        text: `How do you stay updated with new technologies?`,
        type: 'technical',
        expectedDuration: 180,
      },
      {
        id: 5,
        text: `Describe your ideal work environment.`,
        type: 'behavioral',
        expectedDuration: 120,
      },
      {
        id: 6,
        text: `What's the most challenging bug you've fixed?`,
        type: 'technical',
        expectedDuration: 180,
      },
    ];
    fallbackQuestions.push(...mixedQuestions);
  }

  return fallbackQuestions.slice(0, questionCount);
}
