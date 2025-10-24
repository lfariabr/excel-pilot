// __tests__/models/Message.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Message from '../../models/Message';
import Conversation from '../../models/Conversation';
import UserModel from '../../models/User';

describe('Message Model', () => {
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
    // Create test user and conversation
    const user = await UserModel.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'casual'
    });
    testUserId = user._id as mongoose.Types.ObjectId;

    const conversation = await Conversation.create({
      userId: testUserId,
      systemPrompt: 'Test prompt'
    });
    testConversationId = conversation._id as mongoose.Types.ObjectId;
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await UserModel.deleteMany({});
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
