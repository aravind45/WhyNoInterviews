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
    providerName?: LLMProvider
): Promise<InterviewQuestion[]> {
    const provider = getProvider(providerName || getDefaultProvider());
    
    if (!provider.isAvailable()) {
        throw new Error(`${provider.displayName} is not configured. Please check your API keys.`);
    }

    const questionCount = Math.max(3, Math.min(10, Math.floor(params.duration / 3)));
    
    const prompt = `You are an expert technical recruiter and interview coach. Generate ${questionCount} high-quality ${params.interviewType} interview questions for a ${params.jobRole} position.

CONTEXT:
- Job Role: ${params.jobRole}
- Interview Type: ${params.interviewType}
- Experience Level: ${params.experienceLevel}
- Interview Duration: ${params.duration} minutes
- Each question should take 3-5 minutes to answer thoroughly
${params.jobDescription ? `- Job Description: ${params.jobDescription}` : ''}

QUESTION QUALITY REQUIREMENTS:

For TECHNICAL questions:
- Focus on problem-solving approach, not just syntax knowledge
- Include system design concepts for senior roles
- Ask about trade-offs and decision-making processes
- Include real-world scenarios and challenges
- Test depth of understanding, not memorization

For BEHAVIORAL questions:
- Use STAR method framework (Situation, Task, Action, Result)
- Focus on leadership, collaboration, and problem-solving
- Include conflict resolution and decision-making scenarios
- Ask about learning from failures and growth mindset
- Probe for specific examples and measurable outcomes

For MIXED questions:
- Combine technical knowledge with soft skills
- Include questions about technical leadership
- Ask about mentoring and knowledge sharing
- Focus on cross-functional collaboration
- Include questions about staying current with technology

QUESTION STRUCTURE:
- Start with context-setting questions
- Progress from general to specific
- Include follow-up probes within each question
- End with forward-looking or aspirational questions

EXPERIENCE LEVEL ADJUSTMENTS:
- Entry: Focus on fundamentals, learning ability, and potential
- Junior: Basic experience, growth mindset, and collaboration
- Mid: Problem-solving, leadership potential, and technical depth
- Senior: Architecture decisions, mentoring, and strategic thinking
- Lead/Principal: Vision, influence, and organizational impact

Return ONLY a JSON array with this exact format:
[
  {
    "id": 1,
    "text": "Main question with clear context and specific ask. Include follow-up probes like: 'Can you walk me through your thought process?' or 'What would you do differently next time?'",
    "type": "${params.interviewType}",
    "expectedDuration": 240
  }
]

Make questions conversational, specific to the role, and designed to reveal both technical competence and soft skills. No generic questions.`;

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
            expectedDuration: q.expectedDuration || 240
        }));

    } catch (error) {
        console.error('Error generating questions with LLM:', error);
        
        // Fallback to sophisticated questions if LLM fails
        const fallbackQuestions: InterviewQuestion[] = [];
        
        if (params.interviewType === 'technical') {
            const technicalQuestions = [
                { 
                    id: 1, 
                    text: `Walk me through how you would approach designing a scalable system for ${params.jobRole.toLowerCase()} challenges. What are the key architectural decisions you'd need to make, and how would you handle potential bottlenecks?`, 
                    type: 'technical', 
                    expectedDuration: 240 
                },
                { 
                    id: 2, 
                    text: `Describe a complex technical problem you've solved recently. What was your debugging process, and how did you ensure your solution was robust and maintainable?`, 
                    type: 'technical', 
                    expectedDuration: 240 
                },
                { 
                    id: 3, 
                    text: `How do you stay current with technology trends in your field? Can you give me an example of a new technology or methodology you've recently adopted and how you evaluated its benefits?`, 
                    type: 'technical', 
                    expectedDuration: 180 
                },
                { 
                    id: 4, 
                    text: `Tell me about a time when you had to make a trade-off between code quality and delivery timeline. How did you approach this decision, and what was the outcome?`, 
                    type: 'technical', 
                    expectedDuration: 240 
                }
            ];
            fallbackQuestions.push(...technicalQuestions);
        } else if (params.interviewType === 'behavioral') {
            const behavioralQuestions = [
                { 
                    id: 1, 
                    text: `Tell me about a time when you had to lead a project or initiative without formal authority. How did you influence others and ensure successful delivery? What specific actions did you take, and what were the measurable results?`, 
                    type: 'behavioral', 
                    expectedDuration: 240 
                },
                { 
                    id: 2, 
                    text: `Describe a situation where you disagreed with a team member or manager about an important decision. How did you handle the conflict, and what was the outcome? What would you do differently?`, 
                    type: 'behavioral', 
                    expectedDuration: 240 
                },
                { 
                    id: 3, 
                    text: `Give me an example of a significant failure or mistake you made. How did you handle it, what did you learn, and how did you apply those lessons to future situations?`, 
                    type: 'behavioral', 
                    expectedDuration: 240 
                },
                { 
                    id: 4, 
                    text: `Tell me about a time when you had to quickly learn something completely new to complete a project. What was your learning strategy, and how did you ensure quality while working under pressure?`, 
                    type: 'behavioral', 
                    expectedDuration: 240 
                }
            ];
            fallbackQuestions.push(...behavioralQuestions);
        } else {
            // Mixed questions combining technical and behavioral aspects
            const mixedQuestions = [
                { 
                    id: 1, 
                    text: `Tell me about your background and what draws you to this ${params.jobRole} role. What specific aspects of the technical challenges and team dynamics excite you most?`, 
                    type: 'behavioral', 
                    expectedDuration: 180 
                },
                { 
                    id: 2, 
                    text: `Describe a time when you had to explain a complex technical concept to non-technical stakeholders. How did you approach this, and how did you ensure they understood the implications for the business?`, 
                    type: 'technical', 
                    expectedDuration: 240 
                },
                { 
                    id: 3, 
                    text: `How do you approach code reviews and technical mentoring? Can you give me an example of how you've helped a colleague improve their technical skills while maintaining a positive working relationship?`, 
                    type: 'behavioral', 
                    expectedDuration: 240 
                },
                { 
                    id: 4, 
                    text: `What's your process for evaluating and adopting new technologies or frameworks in your work? How do you balance innovation with stability and team productivity?`, 
                    type: 'technical', 
                    expectedDuration: 240 
                }
            ];
            fallbackQuestions.push(...mixedQuestions);
        }
        
        return fallbackQuestions.slice(0, questionCount);
    }
}