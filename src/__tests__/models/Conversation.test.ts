// __tests__/models/Conversation.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Conversation from '../../models/Conversation';
import UserModel from '../../models/User';
import Message from '../../models/Message';

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

    await Message.create([
      { conversationId: conversation._id, userId: testUserId, role: 'user', content: 'First' },
      { conversationId: conversation._id, userId: testUserId, role: 'assistant', content: 'Second', aiModel: 'gpt-4' },
      { conversationId: conversation._id, userId: testUserId, role: 'user', content: 'Third' }
    ]);

    const messages = await Message
      .find({ conversationId: conversation._id })
      .sort({ createdAt: 1 });

    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('First');
    expect(messages[2].content).toBe('Third');
  });
});
});