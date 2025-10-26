// __tests__/models/Message.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Message from '../../models/Message';
import Conversation from '../../models/Conversation';
import UserModel from '../../models/User';

describe('Message Model', () => {
  let mongoServer: MongoMemoryServer;
  let testUserId: mongoose.Types.ObjectId;

  // Type for populated conversation
  interface PopulatedConversation {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    systemPrompt: string;
    title?: string;
    summary?: string;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test user
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
    const conv = populated?.conversationId as unknown as PopulatedConversation;
    expect(conv.systemPrompt).toBe('You are a helpful assistant');
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
describe('Schema Validation', () => {
  it('should fail when conversationId is missing', async () => {
    const invalidMessage = {
      userId: testUserId,
      role: 'user',
      content: 'Test message'
      // conversationId missing!
    };

    await expect(Message.create(invalidMessage))
      .rejects
      .toThrow();
  });

  it('should fail when role is invalid', async () => {
    const conversation = await Conversation.create({
      userId: testUserId,
      systemPrompt: 'Test'
    });

    const invalidMessage = {
      conversationId: conversation._id,
      userId: testUserId,
      role: 'moderator', // Invalid role!
      content: 'Test'
    };

    await expect(Message.create(invalidMessage))
      .rejects
      .toThrow(/`moderator` is not a valid enum value/);
  });

  it('should require aiModel for assistant messages', async () => {
    const conversation = await Conversation.create({
      userId: testUserId,
      systemPrompt: 'Test'
    });

    const invalidAssistant = {
      conversationId: conversation._id,
      userId: testUserId,
      role: 'assistant',
      content: 'Response'
      // aiModel missing!
    };

    await expect(Message.create(invalidAssistant))
      .rejects
      .toThrow();
  });
});
describe('Reference Validation', () => {
  it('should handle invalid conversationId gracefully', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    
    const message = await Message.create({
      conversationId: fakeId,
      userId: testUserId,
      role: 'user',
      content: 'Test'
    });

    expect(message.conversationId).toEqual(fakeId);
    
    // Populate should return null for non-existent conversation
    const populated = await Message.findById(message._id).populate('conversationId');
    expect(populated?.conversationId).toBeNull();
  });
});
describe('Message Ordering', () => {
  it('should retrieve messages in correct order', async () => {
    const conversation = await Conversation.create({
      userId: testUserId,
      systemPrompt: 'Test'
    });

    // Create messages with explicit delays
    const msg1 = await Message.create({
      conversationId: conversation._id,
      userId: testUserId,
      role: 'user',
      content: 'First'
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const msg2 = await Message.create({
      conversationId: conversation._id,
      userId: testUserId,
      role: 'assistant',
      content: 'Second',
      aiModel: 'gpt-4'
    });

    const messages = await Message
      .find({ conversationId: conversation._id })
      .sort({ createdAt: 1 });

    expect(messages[0]._id).toEqual(msg1._id);
    expect(messages[1]._id).toEqual(msg2._id);
  });
});
});

