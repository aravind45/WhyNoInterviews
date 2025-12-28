import { logger } from '../utils/logger';
import { ResumeData, RootCause, ActionableRecommendation, ConfidenceScore } from '../types';
import * as groqService from './groq';
import * as claudeService from './claude';

export type LLMProvider = 'groq' | 'claude';

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
    jobDescription?: string
  ) => Promise<LLMAnalysisResult>;
}

/**
 * Initialize all LLM providers
 */
export const initializeProviders = (): void => {
  groqService.initializeGroq();
  claudeService.initializeClaude();

  const availableProviders: string[] = [];
  if (groqService.isGroqAvailable()) availableProviders.push('Groq');
  if (claudeService.isClaudeAvailable()) availableProviders.push('Claude');

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
        analyzeResume: claudeService.analyzeResume
      };
    case 'groq':
    default:
      return {
        name: 'groq',
        displayName: 'Groq (Llama)',
        isAvailable: groqService.isGroqAvailable,
        analyzeResume: groqService.analyzeResume
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

  if (claudeService.isClaudeAvailable()) {
    providers.push(getProvider('claude'));
  }

  return providers;
};

/**
 * Get default provider (first available)
 */
export const getDefaultProvider = (): LLMProvider => {
  if (groqService.isGroqAvailable()) return 'groq';
  if (claudeService.isClaudeAvailable()) return 'claude';
  return 'groq'; // Fallback even if not available (will error on use)
};

/**
 * Validate provider name
 */
export const isValidProvider = (provider: string): provider is LLMProvider => {
  return provider === 'groq' || provider === 'claude';
};

export default {
  initializeProviders,
  getProvider,
  getAvailableProviders,
  getDefaultProvider,
  isValidProvider
};
