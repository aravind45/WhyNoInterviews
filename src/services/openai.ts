import OpenAI from 'openai';
import { logger } from '../utils/logger';
import type { ResumeData, RootCause, ActionableRecommendation } from '../types';

let openaiClient: OpenAI | null = null;

export const initializeOpenAI = (): void => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'your-openai-api-key-here') {
    logger.warn('OPENAI_API_KEY not configured - OpenAI provider will be unavailable');
    return;
  }

  try {
    openaiClient = new OpenAI({ apiKey });
    logger.info('✓ OpenAI client initialized successfully');
  } catch (error: any) {
    logger.error('Failed to initialize OpenAI client:', error.message);
    openaiClient = null;
  }
};

export const isOpenAIAvailable = (): boolean => {
  return openaiClient !== null;
};

export const analyzeResume = async (
  resumeData: ResumeData,
  targetJob: {
    title: string;
    category: string;
    seniorityLevel: string;
    requiredSkills: string[];
    requiredKeywords: string[];
  },
  jobDescription?: string,
): Promise<{
  rootCauses: RootCause[];
  recommendations: ActionableRecommendation[];
  overallConfidence: number;
  confidenceExplanation: string;
  isCompetitive: boolean;
  dataCompleteness: number;
}> => {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Build prompt (same structure as Groq)
  const prompt = buildAnalysisPrompt(
    resumeData.rawText,
    resumeData.sections.map((s) => ({ type: s.type, title: s.title })),
    targetJob,
    jobDescription,
  );

  try {
    logger.info(`Calling OpenAI API with model: ${model}`);

    const response = await openaiClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    logger.info('✓ Received response from OpenAI');

    // Parse and validate the JSON response
    const analysis = parseAnalysisResponse(content);

    logger.info(
      `OpenAI analysis complete - Competitive: ${analysis.isCompetitive}, Confidence: ${analysis.overallConfidence}%`,
    );
    return analysis;
  } catch (error: any) {
    logger.error('OpenAI API error:', error);
    throw new Error(`OpenAI analysis failed: ${error.message}`);
  }
};

/**
 * Build analysis prompt (matches Groq implementation)
 */
const buildAnalysisPrompt = (
  resumeText: string,
  sections: Array<{ type: string; title: string }>,
  targetJob: {
    title: string;
    category: string;
    seniorityLevel: string;
    requiredSkills: string[];
    requiredKeywords: string[];
  },
  jobDescription?: string,
): string => {
  let prompt = `Analyze this resume for the target position: ${targetJob.title} (${targetJob.seniorityLevel} level, ${targetJob.category})

RESUME CONTENT:
${resumeText.substring(0, 6000)} ${resumeText.length > 6000 ? '...[truncated]' : ''}

RESUME SECTIONS DETECTED:
${sections.map((s) => `- ${s.title} (${s.type})`).join('\n')}

TARGET ROLE REQUIREMENTS:
- Required Skills: ${targetJob.requiredSkills.join(', ')}
- Key Keywords: ${targetJob.requiredKeywords.join(', ')}
`;

  if (jobDescription) {
    prompt += `
JOB DESCRIPTION:
${jobDescription.substring(0, 2000)}
`;
  }

  prompt += `
ANALYSIS TASK:
1. Identify the TOP 5 root causes preventing this candidate from getting interviews
2. For each root cause, provide SPECIFIC evidence from the resume
3. Generate TOP 3 actionable recommendations to fix the most critical issues
4. Assess overall competitiveness for the target role

Focus on specific, citable issues - not generic advice. Be direct and actionable.
`;

  return prompt;
};

const SYSTEM_PROMPT = `You are an expert resume analyst and career coach specializing in identifying why job seekers don't receive interview invitations.

Your analysis must:
1. Be SPECIFIC - cite exact sections, missing keywords, or formatting issues from the resume
2. Be ACTIONABLE - provide implementable fixes, not vague suggestions
3. Be PRIORITIZED - rank issues by severity (1-10) and impact (1-10)
4. Be EVIDENCE-BASED - every claim must have supporting evidence
5. Be HONEST - if the resume is competitive, say so

You must respond in valid JSON format with this structure:
{
  "rootCauses": [
    {
      "title": "Clear, specific issue title",
      "description": "Detailed explanation of the problem",
      "category": "keyword_mismatch|experience_gap|skill_deficiency|formatting_issue|ats_compatibility|quantification_missing|relevance_issue|career_progression|education_mismatch|other",
      "severityScore": 1-10,
      "impactScore": 1-10,
      "evidence": [
        {
          "type": "resume_section|missing_keyword|formatting|market_data|comparison",
          "description": "What the evidence shows",
          "citation": "Exact text or specific reference from resume",
          "confidence": 0-100
        }
      ]
    }
  ],
  "recommendations": [
    {
      "title": "Clear action title",
      "description": "What to do and why",
      "implementationSteps": ["Step 1", "Step 2", "Step 3"],
      "expectedImpact": 1-10,
      "difficulty": "easy|medium|hard",
      "timeEstimate": "e.g., 30 minutes, 2 hours",
      "relatedRootCause": "title of related root cause"
    }
  ],
  "overallConfidence": 0-100,
  "confidenceExplanation": "Why this confidence level based on data quality",
  "isCompetitive": true/false,
  "dataCompleteness": 0-100
}

Limit root causes to 5 maximum, recommendations to 3 maximum.
Lower confidence if resume has missing sections or unclear information.`;

/**
 * Parse and validate AI response
 */
const parseAnalysisResponse = (
  responseText: string,
): {
  rootCauses: RootCause[];
  recommendations: ActionableRecommendation[];
  overallConfidence: number;
  confidenceExplanation: string;
  isCompetitive: boolean;
  dataCompleteness: number;
} => {
  try {
    const data = JSON.parse(responseText);

    // Validate and normalize the response
    return {
      rootCauses: (data.rootCauses || []).slice(0, 5).map((rc: any, idx: number) => ({
        id: `rc-${idx + 1}`,
        title: rc.title || 'Unknown Issue',
        description: rc.description || '',
        category: rc.category || 'other',
        severityScore: Number(rc.severityScore) || 5,
        impactScore: Number(rc.impactScore) || 5,
        evidence: (rc.evidence || []).map((ev: any) => ({
          type: ev.type || 'resume_section',
          description: ev.description || '',
          citation: ev.citation || '',
          location: ev.location,
          confidence: Number(ev.confidence) || 50,
        })),
        relatedRecommendations: [],
      })),
      recommendations: (data.recommendations || []).slice(0, 3).map((rec: any, idx: number) => ({
        id: `rec-${idx + 1}`,
        title: rec.title || 'Recommendation',
        description: rec.description || '',
        implementationSteps: rec.implementationSteps || [],
        expectedImpact: Number(rec.expectedImpact) || 5,
        difficulty: rec.difficulty || 'medium',
        timeEstimate: rec.timeEstimate || 'Unknown',
        relatedRootCause: rec.relatedRootCause || '',
        priority: idx + 1,
      })),
      overallConfidence: Number(data.overallConfidence) || 50,
      confidenceExplanation: data.confidenceExplanation || 'Analysis completed',
      isCompetitive: Boolean(data.isCompetitive),
      dataCompleteness: Number(data.dataCompleteness) || 50,
    };
  } catch (error: any) {
    logger.error('Failed to parse OpenAI response:', error.message);
    throw new Error('Invalid response format from OpenAI');
  }
};
