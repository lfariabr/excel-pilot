// __tests__/services/openAi.test.ts

// Set dummy OpenAI API key for tests (required before imports)
process.env.OPENAI_API_KEY = 'test-api-key';

// Create mock responses.create function
const mockResponsesCreate = jest.fn();

// Mock OpenAI SDK FIRST - before any imports
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    responses: {
      create: mockResponsesCreate
    }
  }));
});

import { getSystemPrompt, askOpenAI } from '../../services/openAi';
import { GraphQLError } from 'graphql';

describe('OpenAI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemPrompt', () => {
    it('should return system prompt with briefing data', () => {
      const prompt = getSystemPrompt();
      
      expect(prompt).toBeDefined();
      expect(prompt).toContain('Excel\'s BM Concierge Personal Assistant');
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should cache system prompt on subsequent calls', () => {
      const firstCall = getSystemPrompt();
      const secondCall = getSystemPrompt();
      
      expect(firstCall).toBe(secondCall); // Same reference = cached
    });
  });

  describe('askOpenAI', () => {

    it('should call OpenAI with correct parameters for simple message', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: 'Test response',
        model: 'gpt-4o-mini',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150
        }
      });

      const result = await askOpenAI({
        userMessage: 'Hello',
        history: []
      });

      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          input: 'Hello',
          temperature: 0.7,
          max_output_tokens: 600
        })
      );

      expect(result.text).toBe('Test response');
      expect(result.model).toBe('gpt-4o-mini');
    });

    it('should include conversation history in instructions', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: 'Response with context',
        model: 'gpt-4o-mini',
        usage: {
          input_tokens: 200,
          output_tokens: 100,
          total_tokens: 300
        }
      });

      const history = [
        { role: 'user' as const, content: 'What is Excel?' },
        { role: 'assistant' as const, content: 'Excel is a spreadsheet application' }
      ];

      await askOpenAI({
        userMessage: 'Tell me more',
        history
      });

      const call = mockResponsesCreate.mock.calls[0][0];
      expect(call.instructions).toContain('Previous conversation:');
      expect(call.instructions).toContain('What is Excel?');
      expect(call.instructions).toContain('Excel is a spreadsheet application');
    });

    it('should return usage statistics in correct format', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: 'Test',
        model: 'gpt-4o-mini',
        usage: {
          input_tokens: 50,
          output_tokens: 30,
          total_tokens: 80
        }
      });

      const result = await askOpenAI({
        userMessage: 'Test',
        history: []
      });

      expect(result.usage).toEqual({
        input_tokens: 50,
        output_tokens: 30,
        total_tokens: 80
      });
    });

    it('should handle missing usage data gracefully', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: 'Test response',
        model: 'gpt-4o-mini'
        // No usage field
      });

      const result = await askOpenAI({
        userMessage: 'Test',
        history: []
      });

      expect(result.usage).toBeNull();
      expect(result.text).toBe('Test response');
    });

    it('should accept custom model parameter', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: 'GPT-4 response',
        model: 'gpt-4',
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
      });

      await askOpenAI({
        userMessage: 'Test',
        history: [],
        model: 'gpt-4'
      });

      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4'
        })
      );
    });

    it('should accept custom temperature parameter', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: 'Response',
        model: 'gpt-4o-mini',
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
      });

      await askOpenAI({
        userMessage: 'Test',
        history: [],
        temperature: 0.3
      });

      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3
        })
      );
    });

    it('should accept custom maxOutputTokens parameter', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: 'Response',
        model: 'gpt-4o-mini',
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
      });

      await askOpenAI({
        userMessage: 'Test',
        history: [],
        maxOutputTokens: 1000
      });

      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_output_tokens: 1000
        })
      );
    });

    it('should throw GraphQLError when OpenAI API fails', async () => {
      mockResponsesCreate.mockRejectedValue(new Error('OpenAI API error'));

      await expect(
        askOpenAI({
          userMessage: 'Test',
          history: []
        })
      ).rejects.toThrow(GraphQLError);

      try {
        await askOpenAI({
          userMessage: 'Test',
          history: []
        });
      } catch (error: any) {
        expect(error.extensions.code).toBe('OPENAI_ERROR');
        expect(error.message).toContain('Failed to get response from OpenAI');
        expect(error.extensions.originalError).toBe('OpenAI API error');
      }
    });

    it('should handle empty output_text gracefully', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: null,
        model: 'gpt-4o-mini',
        usage: { input_tokens: 10, output_tokens: 0, total_tokens: 10 }
      });

      const result = await askOpenAI({
        userMessage: 'Test',
        history: []
      });

      expect(result.text).toBe('');
    });

    it('should reverse history order for context building', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: 'Response',
        model: 'gpt-4o-mini',
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
      });

      const history = [
        { role: 'assistant' as const, content: 'Latest message' },
        { role: 'user' as const, content: 'Previous message' },
        { role: 'assistant' as const, content: 'Oldest message' }
      ];

      await askOpenAI({
        userMessage: 'New message',
        history
      });

      const instructions = mockResponsesCreate.mock.calls[0][0].instructions;
      const latestIndex = instructions.indexOf('Latest message');
      const oldestIndex = instructions.indexOf('Oldest message');
      
      // After reversing, oldest should come before latest
      expect(oldestIndex).toBeLessThan(latestIndex);
    });
  });
});