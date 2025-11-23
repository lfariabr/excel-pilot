// __tests__/models/Conversation.test.ts
// npm test -- src/__tests__/conversations/Conversation.test.ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Conversation from '../../models/Conversation';
import UserModel from '../../models/User';
import Message from '../../models/Message';
import { generateConversationTitle } from '../../services/titleGenerator';

// Mock the OpenAI service to avoid actual API calls
jest.mock('../../services/openAi');
import { askOpenAI } from '../../services/openAi';
const mockAskOpenAI = askOpenAI as jest.MockedFunction<typeof askOpenAI>;

describe('Conversation Model', () => {
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
    const user = await UserModel.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'casual'
    });
    testUserId = user._id as mongoose.Types.ObjectId;

    // Reset and setup mock for each test
    mockAskOpenAI.mockReset();
    mockAskOpenAI.mockResolvedValue({
      text: 'Default Mock Response',
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        total_tokens: 120,
      },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
    });
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await UserModel.deleteMany({});
  });

    describe('Schema Validation', () => {
      it('should create conversation with required fields only', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'You are a helpful assistant'
        });

        expect(conversation.userId).toEqual(testUserId);
        expect(conversation.systemPrompt).toBe('You are a helpful assistant');
        expect(conversation.lastMessageAt).toBeDefined();
        expect(conversation.createdAt).toBeDefined();
        expect(conversation.updatedAt).toBeDefined();
      });

      it('should create conversation with all fields', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test prompt',
          title: 'My Conversation',
          summary: 'A test conversation'
        });

        expect(conversation.title).toBe('My Conversation');
        expect(conversation.summary).toBe('A test conversation');
      });

      it('should fail when userId is missing', async () => {
        const invalidConversation = {
          systemPrompt: 'Test'
          // userId missing!
        };

        await expect(Conversation.create(invalidConversation))
          .rejects
          .toThrow();
      });
    });

    describe('Default Values', () => {
      it('should set lastMessageAt to current time by default', async () => {
        const beforeCreate = new Date();
        
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test'
        });

        const afterCreate = new Date();

        expect(conversation.lastMessageAt).toBeDefined();
        expect(conversation.lastMessageAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
        expect(conversation.lastMessageAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      });

      it('should allow custom lastMessageAt', async () => {
        const customDate = new Date('2024-01-15T10:00:00Z');
        
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test',
          lastMessageAt: customDate
        });

        expect(conversation.lastMessageAt.toISOString()).toBe(customDate.toISOString());
      });
    });

    describe('Optional Fields', () => {
      it('should save conversation without title', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test'
        });

        expect(conversation.title).toBeUndefined();
      });

      it('should save conversation without summary', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test'
        });

        expect(conversation.summary).toBeUndefined();
      });

      it('should save conversation with title', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test',
          title: 'Test Title'
        });

        expect(conversation.title).toBe('Test Title');
      });

      it('should save conversation with summary', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test',
          summary: 'Test Summary'
        });

        expect(conversation.summary).toBe('Test Summary');
      });
    });

    describe('Reference Tests', () => {
      it('should reference valid userId', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test'
        });

        const populated = await Conversation
          .findById(conversation._id)
          .populate('userId');

        expect(populated?.userId).toBeDefined();
        expect((populated?.userId as any).name).toBe('Test User');
      });

      it('should query conversations by userId', async () => {
        await Conversation.create([
          { userId: testUserId, systemPrompt: 'First' },
          { userId: testUserId, systemPrompt: 'Second' },
          { userId: testUserId, systemPrompt: 'Third' }
        ]);

        const conversations = await Conversation.find({ userId: testUserId });

        expect(conversations).toHaveLength(3);
      });
    });

    describe('Timestamp Tests', () => {
      it('should automatically set createdAt and updatedAt', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Test'
        });

        expect(conversation.createdAt).toBeDefined();
        expect(conversation.createdAt).toBeInstanceOf(Date);
        expect(conversation.updatedAt).toBeDefined();
        expect(conversation.updatedAt).toBeInstanceOf(Date);
      });

      it('should update updatedAt when modified', async () => {
        const conversation = await Conversation.create({
          userId: testUserId,
          systemPrompt: 'Original'
        });

        const originalUpdatedAt = conversation.updatedAt;

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));

        conversation.title = 'Updated Title';
        await conversation.save();

        expect(conversation.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      });
    });

    describe('Message-Conversation Integration', () => {
    it('should link messages to conversation correctly', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'You are a helpful assistant'
      });

      const message = await Message.create({
        conversationId: conversation._id,
        userId: testUserId,
        role: 'user',
        content: 'Hello!'
      });

      const populated = await Message
        .findById(message._id)
        .populate('conversationId');

      expect(populated?.conversationId).toBeDefined();
      expect((populated?.conversationId as any).systemPrompt).toBe('You are a helpful assistant');
    });

    it('should retrieve all messages for a conversation', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test'
      });

      await Message.create({ conversationId: conversation._id, userId: testUserId, role: 'user', content: 'First' });
      await Message.create({ conversationId: conversation._id, userId: testUserId, role: 'assistant', content: 'Second', aiModel: 'gpt-4' });
      await Message.create({ conversationId: conversation._id, userId: testUserId, role: 'user', content: 'Third' });

      const messages = await Message
        .find({ conversationId: conversation._id })
        .sort({ createdAt: 1 });

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First');
      expect(messages[2].content).toBe('Third');
    });
  });

    describe('Title generation', () => {
      it('should generate a title for Excel-related conversation', async () => {
        // Mock specific response for this test
        mockAskOpenAI.mockResolvedValueOnce({
          text: 'Creating Excel Pivot Tables',
          usage: { input_tokens: 100, output_tokens: 5, total_tokens: 105 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

        const userMessage = 'How do I create a pivot table in Excel?';
        const aiResponse = 'To create a pivot table in Excel, select your data range, go to Insert > PivotTable, choose your data source and location, then drag fields to the appropriate areas in the PivotTable Fields pane.';

        const title = await generateConversationTitle(userMessage, aiResponse);

        expect(title).toBe('Creating Excel Pivot Tables');
        expect(mockAskOpenAI).toHaveBeenCalledTimes(1);
        expect(mockAskOpenAI).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4o-mini',
            maxOutputTokens: 20,
            temperature: 0.3,
          })
        );
      });

      it('should generate a title for Sydney Opera House-related conversation', async () => {
        mockAskOpenAI.mockResolvedValueOnce({
          text: 'Weekend Shows at Opera House',
          usage: { input_tokens: 100, output_tokens: 6, total_tokens: 106 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

        const userMessage = 'What shows are playing this weekend?';
        const aiResponse = 'I can help you find current performances at the Sydney Opera House. This weekend features several shows including opera, ballet, and concerts. For specific showtimes and tickets, I recommend checking our official website or calling the box office.';

        const title = await generateConversationTitle(userMessage, aiResponse);

        expect(title).toBe('Weekend Shows at Opera House');
        expect(mockAskOpenAI).toHaveBeenCalledTimes(1);
      });

      it('should return fallback title for empty messages', async () => {
        // No API call should be made due to input validation
        const title = await generateConversationTitle('', '');

        expect(title).toBe('New Conversation');
        expect(mockAskOpenAI).not.toHaveBeenCalled();
      });

      it('should handle long responses by truncating in prompt', async () => {
        mockAskOpenAI.mockResolvedValueOnce({
          text: 'Services Overview Discussion',
          usage: { input_tokens: 120, output_tokens: 5, total_tokens: 125 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

        const userMessage = 'Tell me about your services';
        const longResponse = 'A'.repeat(500); // Very long response

        const title = await generateConversationTitle(userMessage, longResponse);

        expect(title).toBe('Services Overview Discussion');
        expect(title.length).toBeLessThanOrEqual(50);
        expect(mockAskOpenAI).toHaveBeenCalledTimes(1);
      });
    });
});