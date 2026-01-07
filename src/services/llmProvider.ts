import { logger } from '../utils/logger';
import { ResumeData, RootCause, ActionableRecommendation, ConfidenceScore } from '../types';
import * as groqService from './groq';
import * as claudeService from './claude';
import * as openaiService from './openai';

export type LLMProvider = 'groq' | 'claude' | 'openai';

export interface LLMAnalysisResult {
  rootCauses: RootCause[];
  recommendations: ActionableRecommendation[];
  overallConfidence: ConfidenceScore;
  confidenceExplanation: string;
  isCompetitive: boolean;
  dataCompleteness: number;
}

export interface LLMProviderService {
  name: LLMProvider;
  displayName: string;
  isAvailable: () => boolean;
  analyzeResume: (
    resumeData: ResumeData,
    targetJob: {
      title: string;
      category: string;
      seniorityLevel: string;
      requiredSkills: string[];
      requiredKeywords: string[];
    },
    jobDescription?: string,
  ) => Promise<LLMAnalysisResult>;
  generateText: (prompt: string) => Promise<string>;
}

/**
 * Initialize all LLM providers
 */
export const initializeProviders = (): void => {
  groqService.initializeGroq();
  claudeService.initializeClaude();
  openaiService.initializeOpenAI();

  const availableProviders: string[] = [];
  if (groqService.isGroqAvailable()) availableProviders.push('Groq');
  if (claudeService.isClaudeAvailable()) availableProviders.push('Claude');
  if (openaiService.isOpenAIAvailable()) availableProviders.push('OpenAI');

  if (availableProviders.length === 0) {
    logger.warn('No LLM providers configured - AI analysis will be unavailable');
  } else {
    logger.info(`LLM providers initialized: ${availableProviders.join(', ')}`);
  }
};

/**
 * Get LLM provider service by name
 */
export const getProvider = (provider: LLMProvider): LLMProviderService => {
  switch (provider) {
    case 'claude':
      return {
        name: 'claude',
        displayName: 'Claude (Anthropic)',
        isAvailable: claudeService.isClaudeAvailable,
        analyzeResume: claudeService.analyzeResume,
        generateText: async (prompt: string) => {
          throw new Error('Claude text generation not implemented yet');
        },
      };
    case 'openai':
      return {
        name: 'openai',
        displayName: 'GPT-4 (OpenAI)',
        isAvailable: openaiService.isOpenAIAvailable,
        analyzeResume: openaiService.analyzeResume,
        generateText: async (prompt: string) => {
          throw new Error('OpenAI text generation not implemented yet');
        },
      };
    case 'groq':
    default:
      return {
        name: 'groq',
        displayName: 'Groq (Llama)',
        isAvailable: groqService.isGroqAvailable,
        analyzeResume: groqService.analyzeResume,
        generateText: groqService.generateText,
      };
  }
};

/**
 * Get list of available providers
 */
export const getAvailableProviders = (): LLMProviderService[] => {
  const providers: LLMProviderService[] = [];

  if (groqService.isGroqAvailable()) {
    providers.push(getProvider('groq'));
  }

  /*
  if (claudeService.isClaudeAvailable()) {
    providers.push(getProvider('claude'));
  }
  */

  if (openaiService.isOpenAIAvailable()) {
    providers.push(getProvider('openai'));
  }

  return providers;
};

/**
 * Get default provider (first available)
 */
export const getDefaultProvider = (): LLMProvider => {
  if (groqService.isGroqAvailable()) return 'groq';
  if (openaiService.isOpenAIAvailable()) return 'openai';
  if (claudeService.isClaudeAvailable()) return 'claude';
  return 'groq'; // Fallback even if not available (will error on use)
};

/**
 * Validate provider name
 */
export const isValidProvider = (provider: string): provider is LLMProvider => {
  return provider === 'groq' || provider === 'claude' || provider === 'openai';
};

export default {
  initializeProviders,
  getProvider,
  getAvailableProviders,
  getDefaultProvider,
  isValidProvider,
};
