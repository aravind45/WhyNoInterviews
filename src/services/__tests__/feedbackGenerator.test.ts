import { generateInterviewFeedback } from '../feedbackGenerator';
import * as db from '../../database/connection';
import * as llmProvider from '../llmProvider';

// Mock dependencies
jest.mock('../../database/connection');
jest.mock('../llmProvider');

describe('Feedback Generator Service', () => {
    const mockQuery = db.query as jest.Mock;
    const mockGenerateText = jest.fn();
    const mockIsAvailable = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();

        // Setup LLM mocks
        (llmProvider.getProvider as jest.Mock).mockReturnValue({
            isAvailable: mockIsAvailable,
            generateText: mockGenerateText,
            displayName: 'Mock LLM'
        });
        (llmProvider.getDefaultProvider as jest.Mock).mockReturnValue('groq');
    });

    it('should throw error if interview session is not found', async () => {
        // Mock session query returning empty
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await expect(generateInterviewFeedback('invalid-session-id'))
            .rejects.toThrow('Interview session not found');
    });

    it('should return default empty-state feedback if no responses exist', async () => {
        // Mock session found
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-1' }] });
        // Mock responses empty
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await generateInterviewFeedback('sess-1');

        expect(result.overallScore).toBe(0);
        expect(result.growthAreas[0]).toContain('Complete the interview');
    });

    it('should generate AI feedback when LLM is available and succeeds', async () => {
        // Mock DB data
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: 'sess-1',
                job_role: 'Software Engineer',
                interview_type: 'technical',
                duration_minutes: 30
            }]
        });
        mockQuery.mockResolvedValueOnce({
            rows: [
                { question_text: 'Explain DI', transcript: 'Dependency Injection is...', question_type: 'technical' }
            ]
        });

        // Mock LLM success
        mockIsAvailable.mockReturnValue(true);
        const mockAiResponse = {
            overallScore: 88,
            rubrics: {
                communication: { score: 5, feedback: 'Excellent' },
                technicalKnowledge: { score: 4, feedback: 'Good' }
            },
            strengths: ['Clear explanations'],
            growthAreas: ['More examples'],
            detailedFeedback: [],
            summary: ['Strong candidate'],
            nextSteps: ['Apply now']
        };
        mockGenerateText.mockResolvedValue(JSON.stringify(mockAiResponse));

        const result = await generateInterviewFeedback('sess-1');

        expect(result.overallScore).toBe(88);
        expect(result.strengths).toContain('Clear explanations');
        expect(mockGenerateText).toHaveBeenCalled();
    });

    it('should fallback to rule-based feedback if LLM is unavailable', async () => {
        // Mock DB data (3 responses for better rule-based score)
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-1', interview_type: 'behavioral' }] });
        mockQuery.mockResolvedValueOnce({
            rows: [
                { transcript: 'Answer 1...', question_type: 'behavioral' },
                { transcript: 'Answer 2...', question_type: 'behavioral' },
                { transcript: 'Answer 3...', question_type: 'behavioral' }
            ]
        });

        // Mock LLM unavailable
        mockIsAvailable.mockReturnValue(false);

        const result = await generateInterviewFeedback('sess-1');

        // Validation of rule-based logic
        // Rule: Base score = min(5, max(1, 2 + (count * 0.5)))
        // 3 responses -> 2 + 1.5 = 3.5 base score.
        // Overall score formula: (avgRubric - 1) * 25
        expect(result.overallScore).toBeGreaterThan(0);
        expect(result.rubrics.activeListening).toBeDefined();
        expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('should fallback to rule-based feedback if LLM returns invalid JSON', async () => {
        // Mock DB
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-1' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ transcript: 'Ans' }] });

        // Mock LLM returns garbage
        mockIsAvailable.mockReturnValue(true);
        mockGenerateText.mockResolvedValue('Not a JSON string');

        const result = await generateInterviewFeedback('sess-1');

        expect(result.overallScore).toBeGreaterThan(0); // Check that we got a valid score
        expect(result.rubrics).toBeDefined();
        // Since it fell back, it called mockGenerateText but result came from rule engine
    });
});
