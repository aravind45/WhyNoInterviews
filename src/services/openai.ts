import OpenAI from 'openai';
import { logger } from '../utils/logger';
import type { ResumeData } from '../types';

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
    description?: string;
  },
  jobDescription?: string
): Promise<{
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  improvements: string[];
  recommendations: string[];
}> => {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized');
  }

  const resumeText = [
    resumeData.name && `Name: ${resumeData.name}`,
    resumeData.email && `Email: ${resumeData.email}`,
    resumeData.phone && `Phone: ${resumeData.phone}`,
    resumeData.summary && `\nSummary:\n${resumeData.summary}`,
    resumeData.experience?.length && `\nExperience:\n${resumeData.experience.map(exp =>
      `- ${exp.title} at ${exp.company} (${exp.duration})\n  ${exp.description || ''}`
    ).join('\n')}`,
    resumeData.education?.length && `\nEducation:\n${resumeData.education.map(edu =>
      `- ${edu.degree} in ${edu.field} from ${edu.institution} (${edu.year})`
    ).join('\n')}`,
    resumeData.skills?.length && `\nSkills:\n${resumeData.skills.join(', ')}`,
    resumeData.certifications?.length && `\nCertifications:\n${resumeData.certifications.join(', ')}`
  ].filter(Boolean).join('\n');

  const jobDesc = jobDescription || targetJob.description || '';

  const prompt = `You are an expert resume analyzer and career coach. Analyze the following resume against the target job.

RESUME:
${resumeText}

TARGET JOB: ${targetJob.title}
${jobDesc ? `\nJOB DESCRIPTION:\n${jobDesc}` : ''}

Please provide a detailed analysis in the following JSON format (respond ONLY with valid JSON, no markdown):

{
  "matchPercentage": <number 0-100>,
  "matchedSkills": ["skill1", "skill2", ...],
  "missingSkills": ["skill1", "skill2", ...],
  "strengths": ["strength1", "strength2", ...],
  "improvements": ["improvement1", "improvement2", ...],
  "recommendations": ["recommendation1", "recommendation2", ...]
}

Important:
- matchPercentage: Overall fit for the role (0-100)
- matchedSkills: Skills from resume that match job requirements
- missingSkills: Key skills mentioned in job description but not in resume
- strengths: Candidate's strong points for this role
- improvements: Areas where candidate could improve
- recommendations: Specific actionable advice for the candidate

Respond with ONLY the JSON object, no additional text or markdown.`;

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    logger.info(`Calling OpenAI API with model: ${model}`);

    const response = await openaiClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    logger.info('✓ Received response from OpenAI');

    // Parse and validate the JSON response
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      logger.error('Failed to parse OpenAI response as JSON:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Validate required fields
    const result = {
      matchPercentage: Number(analysis.matchPercentage) || 0,
      matchedSkills: Array.isArray(analysis.matchedSkills) ? analysis.matchedSkills : [],
      missingSkills: Array.isArray(analysis.missingSkills) ? analysis.missingSkills : [],
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      improvements: Array.isArray(analysis.improvements) ? analysis.improvements : [],
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : []
    };

    logger.info(`OpenAI analysis complete - Match: ${result.matchPercentage}%`);
    return result;

  } catch (error: any) {
    logger.error('OpenAI API error:', error);
    throw new Error(`OpenAI analysis failed: ${error.message}`);
  }
};
