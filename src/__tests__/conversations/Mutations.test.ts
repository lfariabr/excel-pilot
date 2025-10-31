// __tests__/conversations/Mutations.test.ts

// Set dummy OpenAI API key for tests (required before imports)
process.env.OPENAI_API_KEY = 'test-api-key';

// Mock external dependencies FIRST - before any imports that use them
jest.mock('../../services/openAi');
jest.mock('../../services/titleGenerator');
jest.mock('../../middleware/rateLimiter');
jest.mock('../../middleware/rateLimitAnalytics');

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GraphQLError } from 'graphql';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import UserModel from '../../models/User';
import { getSystemPrompt, askOpenAI } from '../../services/openAi';
import { generateConversationTitle } from '../../services/titleGenerator';
import { userRateLimiter } from '../../middleware/rateLimiter';
import { conversationsMutation } from '../../resolvers/conversations/mutations';

describe('Conversation Mutations', () => {
  let mongoServer: MongoMemoryServer;
  let testUserId: mongoose.Types.ObjectId;
  
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create test user
    const user = await UserModel.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'casual'
    });
    testUserId = user._id as mongoose.Types.ObjectId;

    // Mock default successful responses
    (getSystemPrompt as jest.Mock).mockReturnValue('You are a helpful assistant');
    
    (askOpenAI as jest.Mock).mockResolvedValue({
      text: 'AI response text',
      model: 'gpt-4',
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30
      }
    });

    (userRateLimiter.checkUserLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60000
    });

    (userRateLimiter.checkUserTokenBudget as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 49000,
      resetTime: Date.now() + 86400000
    });

    (generateConversationTitle as jest.Mock).mockResolvedValue('Generated Title');
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await UserModel.deleteMany({});
  });

  describe('startConversation', () => {
    it('should create a new conversation with user message and AI response', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const content = 'Hello, this is my first message';
      const result = await conversationsMutation.startConversation(null, { content }, ctx);

      // Verify result structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('content', 'AI response text');
      expect(result).toHaveProperty('role', 'assistant');
      expect(result).toHaveProperty('aiModel', 'gpt-4');
      expect(result).toHaveProperty('createdAt');

      // Verify conversation was created
      const conversations = await Conversation.find({ userId: testUserId });
      expect(conversations).toHaveLength(1);
      expect(conversations[0].systemPrompt).toBe('You are a helpful assistant');

      // Verify messages were created (user + assistant)
      const messages = await Message.find({ conversationId: conversations[0]._id });
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe(content);
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('AI response text');
    });

    it('should call OpenAI with correct parameters', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const content = 'What is the weather?';
      await conversationsMutation.startConversation(null, { content }, ctx);

      expect(askOpenAI).toHaveBeenCalledWith({
        userMessage: content,
        history: [] // First message has no history
      });
    });

    it('should store token usage information', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await conversationsMutation.startConversation(null, { content: 'Test' }, ctx);

      const messages = await Message.find({ role: 'assistant' });
      expect(messages[0].usage).toBeDefined();
      expect(messages[0].usage?.input_tokens).toBe(10);
      expect(messages[0].usage?.output_tokens).toBe(20);
      expect(messages[0].usage?.total_tokens).toBe(30);
    });

    it('should throw UNAUTHENTICATED when user is null', async () => {
      const ctx = { user: null };

      await expect(
        conversationsMutation.startConversation(null, { content: 'Test' }, ctx)
      ).rejects.toThrow(GraphQLError);

      try {
        await conversationsMutation.startConversation(null, { content: 'Test' }, ctx);
      } catch (error: any) {
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should throw UNAUTHENTICATED when ctx.user is undefined', async () => {
      const ctx = {};

      await expect(
        conversationsMutation.startConversation(null, { content: 'Test' }, ctx)
      ).rejects.toThrow(GraphQLError);
    });

    it('should throw RATE_LIMIT_EXCEEDED when conversation rate limit is hit', async () => {
      (userRateLimiter.checkUserLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 30000
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await expect(
        conversationsMutation.startConversation(null, { content: 'Test' }, ctx)
      ).rejects.toThrow(GraphQLError);

      try {
        await conversationsMutation.startConversation(null, { content: 'Test' }, ctx);
      } catch (error: any) {
        expect(error.extensions.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.extensions.remaining).toBe(0);
      }
    });

    it('should throw TOKEN_BUDGET_EXCEEDED when token budget is exhausted', async () => {
      (userRateLimiter.checkUserTokenBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 3600000
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await expect(
        conversationsMutation.startConversation(null, { content: 'Test' }, ctx)
      ).rejects.toThrow(GraphQLError);

      try {
        await conversationsMutation.startConversation(null, { content: 'Test' }, ctx);
      } catch (error: any) {
        expect(error.extensions.code).toBe('TOKEN_BUDGET_EXCEEDED');
        expect(error.message).toContain('Daily token budget exceeded');
      }
    });

    it('should check rate limits before creating conversation', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await conversationsMutation.startConversation(null, { content: 'Test' }, ctx);

      expect(userRateLimiter.checkUserLimit).toHaveBeenCalledWith(
        testUserId.toString(),
        'conversations'
      );
    });

    it('should check token budget with estimated tokens', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await conversationsMutation.startConversation(null, { content: 'Test message' }, ctx);

      expect(userRateLimiter.checkUserTokenBudget).toHaveBeenCalledWith(
        testUserId.toString(),
        expect.any(Number) // Estimated tokens
      );
    });

    it('should update conversation lastMessageAt timestamp', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const beforeTime = new Date();
      await conversationsMutation.startConversation(null, { content: 'Test' }, ctx);
      const afterTime = new Date();

      const conversation = await Conversation.findOne({ userId: testUserId });
      expect(conversation?.lastMessageAt).toBeDefined();
      expect(conversation!.lastMessageAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(conversation!.lastMessageAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should trigger title generation asynchronously', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const content = 'What is TypeScript?';
      await conversationsMutation.startConversation(null, { content }, ctx);

      // Wait a bit for async title generation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(generateConversationTitle).toHaveBeenCalledWith(
        content,
        'AI response text'
      );
    });

    it('should handle OpenAI errors gracefully', async () => {
      (askOpenAI as jest.Mock).mockRejectedValue(new Error('OpenAI API error'));

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await expect(
        conversationsMutation.startConversation(null, { content: 'Test' }, ctx)
      ).rejects.toThrow('OpenAI API error');
    });
  });
});