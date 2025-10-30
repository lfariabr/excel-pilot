// __tests__/auth/authIntegration.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { authMutations } from '../../resolvers/auth/mutations';
import { authQueries } from '../../resolvers/auth/queries';
import UserModel from '../../models/User';
import { verifyAccessToken } from '../../utils/jwt';

describe('Authentication Integration Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  describe('Complete Authentication Flow', () => {
    it('should register → login → access protected resource', async () => {
      // Step 1: Register
      const registerInput = {
        name: 'Integration User',
        email: 'integration@example.com',
        password: 'securePassword123',
        role: 'manager' as const
      };

      const registerResult = await authMutations.register(null, { input: registerInput });
      
      expect(registerResult.accessToken).toBeDefined();
      expect(registerResult.user.email).toBe(registerInput.email);

      // Step 2: Login with same credentials
      const loginInput = {
        email: registerInput.email,
        password: registerInput.password
      };

      const loginResult = await authMutations.login(null, { input: loginInput });
      
      expect(loginResult.accessToken).toBeDefined();
      expect(loginResult.user.email).toBe(registerInput.email);

      // Step 3: Use token to access protected resource (me query)
      const decoded = verifyAccessToken(loginResult.accessToken);
      expect(decoded).not.toBeNull();

      const ctx = { user: decoded };
      const meResult = await authQueries.me(null, null, ctx);

      expect(meResult?.email).toBe(registerInput.email);
      expect(meResult?.name).toBe(registerInput.name);
      expect(meResult?.role).toBe(registerInput.role);
    });

    it('should prevent access with expired token', async () => {
      // Register user
      const input = {
        name: 'Expiry Test',
        email: 'expiry@example.com',
        password: 'password123',
        role: 'casual' as const
      };

      await authMutations.register(null, { input });

      // Simulate expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwicm9sZSI6ImNhc3VhbCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwOTAwfQ.invalid';
      
      const decoded = verifyAccessToken(expiredToken);
      expect(decoded).toBeNull();

      const ctx = { user: decoded };

      await expect(authQueries.me(null, null, ctx))
        .rejects
        .toThrow(); // Should throw UNAUTHENTICATED
    });

    it('should handle multiple user registrations', async () => {
      const users = [
        { name: 'Admin User', email: 'admin@test.com', password: 'pass123', role: 'admin' as const },
        { name: 'Manager User', email: 'manager@test.com', password: 'pass123', role: 'manager' as const },
        { name: 'Casual User', email: 'casual@test.com', password: 'pass123', role: 'casual' as const },
      ];

      for (const userData of users) {
        const result = await authMutations.register(null, { input: userData });
        expect(result.user.email).toBe(userData.email);
        expect(result.user.role).toBe(userData.role);
      }

      const allUsers = await UserModel.find({});
      expect(allUsers).toHaveLength(3);
    });

    it('should maintain separate sessions for different users', async () => {
      // Register two users
      const user1 = {
        name: 'User One',
        email: 'user1@test.com',
        password: 'password1',
        role: 'admin' as const
      };

      const user2 = {
        name: 'User Two',
        email: 'user2@test.com',
        password: 'password2',
        role: 'casual' as const
      };

      const reg1 = await authMutations.register(null, { input: user1 });
      const reg2 = await authMutations.register(null, { input: user2 });

      // Verify tokens are different
      expect(reg1.accessToken).not.toBe(reg2.accessToken);

      // Verify each token accesses correct user
      const decoded1 = verifyAccessToken(reg1.accessToken);
      const decoded2 = verifyAccessToken(reg2.accessToken);

      expect(decoded1?.email).toBe(user1.email);
      expect(decoded2?.email).toBe(user2.email);

      const me1 = await authQueries.me(null, null, { user: decoded1 });
      const me2 = await authQueries.me(null, null, { user: decoded2 });

      expect(me1?.email).toBe(user1.email);
      expect(me2?.email).toBe(user2.email);
    });
  });
});