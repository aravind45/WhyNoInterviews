-- Migration: Add LLM provider field to track which AI model was used
-- Date: 2025-12-28

-- Add llm_provider column to resume_analyses table
ALTER TABLE resume_analyses
ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(50) DEFAULT 'groq'
CHECK (llm_provider IN ('groq', 'claude', 'openai'));

-- Add llm_provider column to diagnosis_results table (for better tracking)
ALTER TABLE diagnosis_results
ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(50) DEFAULT 'groq'
CHECK (llm_provider IN ('groq', 'claude', 'openai'));

-- Create index for faster filtering by provider
CREATE INDEX IF NOT EXISTS idx_resume_analyses_llm_provider ON resume_analyses(llm_provider);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_llm_provider ON diagnosis_results(llm_provider);

-- Update model_used column comment to clarify it's now more specific
COMMENT ON COLUMN diagnosis_results.model_used IS 'Specific model name (e.g., llama-3.1-8b-instant, claude-sonnet-4-5-20250929, gpt-4o-mini)';
COMMENT ON COLUMN diagnosis_results.llm_provider IS 'LLM provider used (groq, claude, or openai)';
COMMENT ON COLUMN resume_analyses.llm_provider IS 'LLM provider requested for analysis (groq, claude, or openai)';
