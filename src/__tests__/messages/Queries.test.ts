// __tests__/messages/Queries.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GraphQLError } from 'graphql';
import { messagesQuery } from '../../resolvers/messages/queries';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import UserModel from '../../models/User';

describe('Message Queries', () => {
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

  describe('messages', () => {
    it('should return messages in connection format with edges and pageInfo', async () => {
      // Create test conversation
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt',
        title: 'Test Title',
        summary: 'Test Summary'
      });
        
      // Create test messages
      await Message.create([
        {
          conversationId: conversation._id,
          userId: testUserId,
          role: 'user',
          content: 'Test message 1'
        },
        {
          conversationId: conversation._id,
          userId: testUserId,
          role: 'assistant',
          content: 'Test message 2',
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
        
      const result = await messagesQuery.messages(null, { conversationId: (conversation._id as mongoose.Types.ObjectId).toString() }, ctx);
        
      // Verify connection structure
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('pageInfo');
      
      // Verify edges
      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].node.content).toBe('Test message 2'); // Newest first
      expect(result.edges[1].node.content).toBe('Test message 1');
      
      // Verify cursor exists
      expect(result.edges[0].cursor).toBeDefined();
      expect(result.edges[1].cursor).toBeDefined();
      
      // Verify pageInfo
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
      expect(result.pageInfo.startCursor).toBeDefined();
      expect(result.pageInfo.endCursor).toBeDefined();
    });

    it('should return messages sorted by newest first', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt'
      });

      // Create messages with delay to ensure different timestamps
      const msg1 = await Message.create({
        conversationId: conversation._id,
        userId: testUserId,
        role: 'user',
        content: 'First message'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const msg2 = await Message.create({
        conversationId: conversation._id,
        userId: testUserId,
        role: 'assistant',
        content: 'Second message',
        aiModel: 'gpt-4'
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await messagesQuery.messages(null, { conversationId: (conversation._id as mongoose.Types.ObjectId).toString() }, ctx);

      expect(result.edges[0].node.content).toBe('Second message'); // Newest first
      expect(result.edges[1].node.content).toBe('First message');
    });

    it('should throw UNAUTHENTICATED when user is null', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt'
      });

      const ctx = { user: null };

      await expect(
        messagesQuery.messages(null, { conversationId: (conversation._id as mongoose.Types.ObjectId).toString() }, ctx)
      ).rejects.toThrow(GraphQLError);

      try {
        await messagesQuery.messages(null, { conversationId: (conversation._id as mongoose.Types.ObjectId).toString() }, ctx);
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
      const conversation = await Conversation.create({
        userId: otherUser._id,
        systemPrompt: 'Test system prompt'
      });

      await Message.create({
        conversationId: conversation._id,
        userId: otherUser._id,
        role: 'user',
        content: 'Other user message'
      });

      // Try to access with testUser
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      await expect(
        messagesQuery.messages(null, { conversationId: (conversation._id as mongoose.Types.ObjectId).toString() }, ctx)
      ).rejects.toThrow(GraphQLError);

      try {
        await messagesQuery.messages(null, { conversationId: (conversation._id as mongoose.Types.ObjectId).toString() }, ctx);
      } catch (error: any) {
        expect(error.extensions.code).toBe('FORBIDDEN');
      }
    });

    it('should handle empty conversation', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt'
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await messagesQuery.messages(null, { conversationId: (conversation._id as mongoose.Types.ObjectId).toString() }, ctx);

      expect(result.edges).toHaveLength(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('should respect pagination limit (first parameter)', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt'
      });

      // Create 5 messages
      for (let i = 1; i <= 5; i++) {
        await Message.create({
          conversationId: conversation._id,
          userId: testUserId,
          role: 'user',
          content: `Message ${i}`
        });
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      // Request only first 3 messages
      const result = await messagesQuery.messages(
        null,
        { conversationId: (conversation._id as mongoose.Types.ObjectId).toString(), first: 3 },
        ctx
      );

      expect(result.edges).toHaveLength(3);
      expect(result.pageInfo.hasNextPage).toBe(true); // More messages available
    });

    it('should handle cursor-based pagination with after parameter', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt'
      });

      // Create 3 messages
      await Message.create([
        {
          conversationId: conversation._id,
          userId: testUserId,
          role: 'user',
          content: 'Message 1'
        },
        {
          conversationId: conversation._id,
          userId: testUserId,
          role: 'user',
          content: 'Message 2'
        },
        {
          conversationId: conversation._id,
          userId: testUserId,
          role: 'user',
          content: 'Message 3'
        }
      ]);

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      // Get first page
      const firstPage = await messagesQuery.messages(
        null,
        { conversationId: (conversation._id as mongoose.Types.ObjectId).toString(), first: 2 },
        ctx
      );

      expect(firstPage.edges).toHaveLength(2);
      expect(firstPage.pageInfo.hasNextPage).toBe(true);

      // Get next page using cursor
      const secondPage = await messagesQuery.messages(
        null,
        {
          conversationId: (conversation._id as mongoose.Types.ObjectId).toString(),
          first: 2,
          after: firstPage.pageInfo.endCursor
        },
        ctx
      );

      expect(secondPage.edges).toHaveLength(1); // Only 1 message left
      expect(secondPage.pageInfo.hasNextPage).toBe(false);
      expect(secondPage.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should include formatted timestamps', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt'
      });

      await Message.create({
        conversationId: conversation._id,
        userId: testUserId,
        role: 'user',
        content: 'Test message'
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await messagesQuery.messages(null, { conversationId: (conversation._id as mongoose.Types.ObjectId).toString() }, ctx);

      // Verify timestamp is ISO format
      expect(result.edges[0].node.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});