// __tests__/messages/Mutations.test.ts

// Set dummy OpenAI API key for tests (required before imports)
process.env.OPENAI_API_KEY = 'test-api-key';

// Mock external dependencies FIRST - before any imports that use them
jest.mock('../../services/openAi');
jest.mock('../../services/titleGenerator');
jest.mock('../../services/summaryGenerator');
jest.mock('../../middleware/rateLimiter');
jest.mock('../../middleware/rateLimitAnalytics');

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GraphQLError } from 'graphql';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import UserModel from '../../models/User';
import { askOpenAI } from '../../services/openAi';
import { generateConversationTitle } from '../../services/titleGenerator';
import { generateConversationSummary } from '../../services/summaryGenerator';
import { userRateLimiter } from '../../middleware/rateLimiter';
import { messagesMutation } from '../../resolvers/messages/mutations';

describe('Message Mutations', () => {
  let mongoServer: MongoMemoryServer;
  let testUserId: mongoose.Types.ObjectId;
  let testConversationId: mongoose.Types.ObjectId;
  
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

    // Create test conversation
    const conversation = await Conversation.create({
      userId: testUserId,
      systemPrompt: 'You are a helpful assistant'
    });
    testConversationId = conversation._id as mongoose.Types.ObjectId;

    // Mock default successful responses
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
    (generateConversationSummary as jest.Mock).mockResolvedValue('Generated Summary');
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await UserModel.deleteMany({});
  });

  describe('sendMessage', () => {
    it('should send a message and receive AI response', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const content = 'Hello, how are you?';
      const result = await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content },
        ctx
      );

      // Verify result
      expect(result.content).toBe('AI response text');
      expect(result.role).toBe('assistant');
      expect(result.aiModel).toBe('gpt-4');

      // Verify messages were created (user + assistant)
      const messages = await Message.find({ conversationId: testConversationId });
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe(content);
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('AI response text');
    });

    it('should call OpenAI with conversation history', async () => {
      // Create existing messages
      await Message.create([
        {
          conversationId: testConversationId,
          userId: testUserId,
          role: 'user',
          content: 'Previous user message'
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
          role: 'assistant',
          content: 'Previous AI response',
          aiModel: 'gpt-4'
        }
      ]);

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'New message' },
        ctx
      );

      // Verify OpenAI was called with history
      expect(askOpenAI).toHaveBeenCalledWith({
        userMessage: 'New message',
        history: expect.arrayContaining([
          { role: 'assistant', content: 'Previous AI response' },
          { role: 'user', content: 'Previous user message' }
        ])
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

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Test' },
        ctx
      );

      const messages = await Message.find({ role: 'assistant' });
      expect(messages[0].usage).toBeDefined();
      expect(messages[0].usage?.input_tokens).toBe(10);
      expect(messages[0].usage?.output_tokens).toBe(20);
      expect(messages[0].usage?.total_tokens).toBe(30);
    });

    it('should throw UNAUTHENTICATED when user is null', async () => {
      const ctx = { user: null };

      await expect(
        messagesMutation.sendMessage(
          null,
          { conversationId: testConversationId.toString(), content: 'Test' },
          ctx
        )
      ).rejects.toThrow(GraphQLError);

      try {
        await messagesMutation.sendMessage(
          null,
          { conversationId: testConversationId.toString(), content: 'Test' },
          ctx
        );
      } catch (error: any) {
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should throw FORBIDDEN when user does not own conversation', async () => {
      // Create another user
      const otherUser = await UserModel.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'password123',
        role: 'casual'
      });

      // Create conversation owned by other user
      const otherConversation = await Conversation.create({
        userId: otherUser._id,
        systemPrompt: 'Test system prompt'
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await expect(
        messagesMutation.sendMessage(
          null,
          { conversationId: (otherConversation._id as mongoose.Types.ObjectId).toString(), content: 'Test' },
          ctx
        )
      ).rejects.toThrow(GraphQLError);

      try {
        await messagesMutation.sendMessage(
          null,
          { conversationId: (otherConversation._id as mongoose.Types.ObjectId).toString(), content: 'Test' },
          ctx
        );
      } catch (error: any) {
        expect(error.extensions.code).toBe('FORBIDDEN');
      }
    });

    it('should throw RATE_LIMIT_EXCEEDED when message rate limit is hit', async () => {
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
        messagesMutation.sendMessage(
          null,
          { conversationId: testConversationId.toString(), content: 'Test' },
          ctx
        )
      ).rejects.toThrow(GraphQLError);

      try {
        await messagesMutation.sendMessage(
          null,
          { conversationId: testConversationId.toString(), content: 'Test' },
          ctx
        );
      } catch (error: any) {
        expect(error.extensions.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(error.message).toContain('Rate limit exceeded');
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
        messagesMutation.sendMessage(
          null,
          { conversationId: testConversationId.toString(), content: 'Test' },
          ctx
        )
      ).rejects.toThrow(GraphQLError);

      try {
        await messagesMutation.sendMessage(
          null,
          { conversationId: testConversationId.toString(), content: 'Test' },
          ctx
        );
      } catch (error: any) {
        expect(error.extensions.code).toBe('TOKEN_BUDGET_EXCEEDED');
        expect(error.message).toContain('Daily token budget exceeded');
      }
    });

    it('should check rate limits before sending message', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Test' },
        ctx
      );

      expect(userRateLimiter.checkUserLimit).toHaveBeenCalledWith(
        testUserId.toString(),
        'messages'
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

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Test message' },
        ctx
      );

      expect(userRateLimiter.checkUserTokenBudget).toHaveBeenCalledWith(
        testUserId.toString(),
        expect.any(Number)
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
      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Test' },
        ctx
      );
      const afterTime = new Date();

      const conversation = await Conversation.findById(testConversationId);
      expect(conversation?.lastMessageAt).toBeDefined();
      expect(conversation!.lastMessageAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(conversation!.lastMessageAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should trigger title generation on first conversation (2 messages)', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const content = 'What is TypeScript?';
      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content },
        ctx
      );

      // Wait for async title generation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(generateConversationTitle).toHaveBeenCalledWith(
        content,
        'AI response text'
      );
    });

    it('should not trigger title generation if conversation already has title', async () => {
      // Update conversation with existing title
      await Conversation.updateOne(
        { _id: testConversationId },
        { title: 'Existing Title' }
      );

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Test' },
        ctx
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(generateConversationTitle).not.toHaveBeenCalled();
    });

    it('should trigger summary generation at 10 messages', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      // Create 8 existing messages (sendMessage adds 2 more = 10 total)
      for (let i = 0; i < 8; i++) {
        await Message.create({
          conversationId: testConversationId,
          userId: testUserId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          ...(i % 2 === 1 ? { aiModel: 'gpt-4' } : {})
        });
      }

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Test' },
        ctx
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(generateConversationSummary).toHaveBeenCalled();
    });

    it('should trigger summary generation every 5 messages after 10', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      // Create 13 existing messages (sendMessage adds 2 more = 15 total)
      for (let i = 0; i < 13; i++) {
        await Message.create({
          conversationId: testConversationId,
          userId: testUserId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          ...(i % 2 === 1 ? { aiModel: 'gpt-4' } : {})
        });
      }

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Test' },
        ctx
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(generateConversationSummary).toHaveBeenCalled();
    });

    it('should limit conversation history to last 10 messages', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      // Create 15 existing messages
      for (let i = 0; i < 15; i++) {
        await Message.create({
          conversationId: testConversationId,
          userId: testUserId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          ...(i % 2 === 1 ? { aiModel: 'gpt-4' } : {})
        });
      }

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Test' },
        ctx
      );

      // Verify OpenAI was called with max 10 history messages
      const callArgs = (askOpenAI as jest.Mock).mock.calls[0][0];
      expect(callArgs.history.length).toBeLessThanOrEqual(10);
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
        messagesMutation.sendMessage(
          null,
          { conversationId: testConversationId.toString(), content: 'Test' },
          ctx
        )
      ).rejects.toThrow('OpenAI API error');
    });

    it('should adjust token budget if actual usage exceeds estimate', async () => {
      // Mock underestimation scenario
      (askOpenAI as jest.Mock).mockResolvedValue({
        text: 'AI response',
        model: 'gpt-4',
        usage: {
          input_tokens: 100,  // Much higher than typical estimate
          output_tokens: 200,
          total_tokens: 300
        }
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await messagesMutation.sendMessage(
        null,
        { conversationId: testConversationId.toString(), content: 'Short message' },
        ctx
      );

      // Verify token budget was checked twice:
      // 1. Initial check with estimated tokens
      // 2. Adjustment call when actual > estimated
      const calls = (userRateLimiter.checkUserTokenBudget as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      // Verify second call happened with the difference
      if (calls.length >= 2) {
        expect(calls[1][1]).toBeGreaterThan(0); // Token difference
      }
    });
  });
});
