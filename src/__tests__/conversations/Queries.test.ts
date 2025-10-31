// __tests__/conversations/Queries.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GraphQLError } from 'graphql';
import { conversationsQuery } from '../../resolvers/conversations/queries';
import Conversation from '../../models/Conversation';
import UserModel from '../../models/User';

describe('Conversation Queries', () => {
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
    await Conversation.deleteMany({});
    await UserModel.deleteMany({});
  });

  describe('conversations', () => {
    it('should return all conversations for authenticated user', async () => {
      // Create test conversations
      await Conversation.create([
        {
          userId: testUserId,
          systemPrompt: 'System prompt 1',
          title: 'First Conversation',
          summary: 'Summary 1'
        },
        {
          userId: testUserId,
          systemPrompt: 'System prompt 2',
          title: 'Second Conversation',
          summary: 'Summary 2'
        }
      ]);

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await conversationsQuery.conversations(null, null, ctx);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Second Conversation'); // Most recent first (sorted by updatedAt)
      expect(result[1].title).toBe('First Conversation');
      
      // Verify formatted timestamps (should be ISO strings)
      expect(result[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result[0].lastMessageAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return empty array when user has no conversations', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await conversationsQuery.conversations(null, null, ctx);

      expect(result).toEqual([]);
    });

    it('should throw UNAUTHENTICATED when user is not authenticated', async () => {
      const ctx = { user: null };

      await expect(conversationsQuery.conversations(null, null, ctx))
        .rejects
        .toThrow(GraphQLError);

      try {
        await conversationsQuery.conversations(null, null, ctx);
      } catch (error: any) {
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should throw UNAUTHENTICATED when ctx.user is undefined', async () => {
      const ctx = {};

      await expect(conversationsQuery.conversations(null, null, ctx))
        .rejects
        .toThrow(GraphQLError);
    });

    it('should only return conversations belonging to the authenticated user', async () => {
      // Create another user
      const otherUser = await UserModel.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'password123',
        role: 'casual'
      });

      // Create conversations for both users
      await Conversation.create([
        {
          userId: testUserId,
          systemPrompt: 'User 1 conversation',
          title: 'My Conversation'
        },
        {
          userId: otherUser._id,
          systemPrompt: 'User 2 conversation',
          title: 'Other User Conversation'
        }
      ]);

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await conversationsQuery.conversations(null, null, ctx);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('My Conversation');
    });

    it('should sort conversations by updatedAt descending', async () => {
      // Create conversations with delays to ensure different timestamps
      const conv1 = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'First',
        title: 'Oldest'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const conv2 = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Second',
        title: 'Middle'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const conv3 = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Third',
        title: 'Newest'
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await conversationsQuery.conversations(null, null, ctx);

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Newest');  // Most recent first
      expect(result[1].title).toBe('Middle');
      expect(result[2].title).toBe('Oldest');  // Oldest last
    });

    it('should include all conversation fields', async () => {
      const conversation = await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt',
        title: 'Test Title',
        summary: 'Test Summary'
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await conversationsQuery.conversations(null, null, ctx);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('title', 'Test Title');
      expect(result[0]).toHaveProperty('summary', 'Test Summary');
      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('updatedAt');
      expect(result[0]).toHaveProperty('lastMessageAt');
      expect(result[0].id).toBe((conversation._id as mongoose.Types.ObjectId).toString());
    });

    it('should handle conversations without optional fields', async () => {
      await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test system prompt'
        // No title or summary
      });

      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await conversationsQuery.conversations(null, null, ctx);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBeUndefined();
      expect(result[0].summary).toBeUndefined();
    });
  });
});