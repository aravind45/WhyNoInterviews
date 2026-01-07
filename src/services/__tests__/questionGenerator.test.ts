import { generateInterviewQuestions } from '../questionGenerator';
import * as llmProvider from '../llmProvider';

// Mock the entire llmProvider module
jest.mock('../llmProvider');

describe('Question Generator Service', () => {
  const mockGenerateText = jest.fn();
  const mockIsAvailable = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    // Setup default behaviors
    (llmProvider.getProvider as jest.Mock).mockReturnValue({
      isAvailable: mockIsAvailable,
      generateText: mockGenerateText,
      displayName: 'Mock Provider',
    });

    (llmProvider.getDefaultProvider as jest.Mock).mockReturnValue('groq');
  });

  it('should generate questions using LLM when available', async () => {
    // Arrange
    mockIsAvailable.mockReturnValue(true);
    const mockQuestions = [
      { id: 1, text: 'Describe a complex closure.', type: 'technical', expectedDuration: 180 },
      { id: 2, text: 'How do you handle async errors?', type: 'technical', expectedDuration: 120 },
    ];
    mockGenerateText.mockResolvedValue(JSON.stringify(mockQuestions));

    // Act
    const result = await generateInterviewQuestions(
      {
        jobRole: 'Frontend Dev',
        interviewType: 'technical',
        experienceLevel: 'senior',
        duration: 30,
        jobDescription: 'React expert needed',
      },
      'groq',
    );

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Describe a complex closure.');
    expect(mockGenerateText).toHaveBeenCalledWith(expect.stringContaining('React expert needed'));
  });

  it('should use fallback questions when LLM is unavailable', async () => {
    // Arrange
    mockIsAvailable.mockReturnValue(false); // LLM Down

    // Act
    const result = await generateInterviewQuestions({
      jobRole: 'Backend Dev',
      interviewType: 'technical',
      experienceLevel: 'mid',
      duration: 30,
    });

    // Assert
    expect(result.length).toBeGreaterThan(0);
    expect(mockGenerateText).not.toHaveBeenCalled();
    // Check valid fallback content (from static list in code)
    expect(result[0].text).toBeDefined();
  });

  it('should use fallback questions when LLM generation fails', async () => {
    // Arrange
    mockIsAvailable.mockReturnValue(true);
    mockGenerateText.mockRejectedValue(new Error('API Rate Limit'));

    // Act
    const result = await generateInterviewQuestions({
      jobRole: 'DevOps',
      interviewType: 'behavioral',
      experienceLevel: 'entry',
      duration: 30,
    });

    // Assert
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe('behavioral'); // Fallback should match type
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('should parse LLM response containing markdown code blocks', async () => {
    // Arrange
    mockIsAvailable.mockReturnValue(true);
    const jsonContent = JSON.stringify([
      { id: 1, text: 'Q1', type: 'mixed', expectedDuration: 60 },
    ]);
    const llmResponse = `Here are the questions:\n\`\`\`json\n${jsonContent}\n\`\`\``;
    mockGenerateText.mockResolvedValue(llmResponse);

    // Act
    const result = await generateInterviewQuestions({
      jobRole: 'Manager',
      interviewType: 'mixed',
      experienceLevel: 'lead',
      duration: 15,
    });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Q1');
  });

  it('should calculate question count based on duration', async () => {
    // duration 30 / 3 = 10 questions max
    // duration 9 / 3 = 3 questions min

    // Mock LLM to return what is asked in prompt (we can't check variable inside function easily,
    // but we can check the prompt sent to generateText contains the count)
    mockIsAvailable.mockReturnValue(true);
    mockGenerateText.mockResolvedValue('[]'); // Return empty valid array to avoid parsing error but check call args

    await generateInterviewQuestions({
      jobRole: 'QA',
      interviewType: 'technical',
      experienceLevel: 'mid',
      duration: 9, // Should request 3 questions
    });

    const promptCall = mockGenerateText.mock.calls[0][0];
    expect(promptCall).toContain('Generate 3 realistic');
  });
});
