// __tests__/auth/authQueries.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { authQueries } from '../../resolvers/auth/queries';
import UserModel from '../../models/User';
import { GraphQLError } from 'graphql';

describe('Auth Queries', () => {
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
    await UserModel.deleteMany({});
  });

  describe('me', () => {
    it('should return current user when authenticated', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };
      
      const result = await authQueries.me(null, null, ctx);

      expect(result).toBeDefined();
      expect((result as any)._id.toString()).toBe(testUserId.toString());
      expect((result as any).name).toBe('Test User');
      expect(result?.email).toBe('test@example.com');
      expect(result?.role).toBe('casual');
    });

    it('should throw UNAUTHENTICATED when user is not authenticated', async () => {
      const ctx = { user: null };

      await expect(authQueries.me(null, null, ctx))
        .rejects
        .toThrow(GraphQLError);

      try {
        await authQueries.me(null, null, ctx);
      } catch (error: any) {
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should return null when authenticated but user not found in DB', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const ctx = {
        user: {
          sub: nonExistentId.toString(),
          role: 'casual',
          email: 'ghost@example.com'
        }
      };

      const result = await authQueries.me(null, null, ctx);
      expect(result).toBeNull();
    });

    it('should not return password field', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          role: 'casual',
          email: 'test@example.com'
        }
      };

      const result = await authQueries.me(null, null, ctx) as any;

      expect(result).toBeDefined();
      expect(result.password).toBeUndefined();
    });
  });
});