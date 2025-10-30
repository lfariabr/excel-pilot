// __tests__/auth/authMutations.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { authMutations } from '../../resolvers/auth/mutations';
import UserModel from '../../models/User';
import { GraphQLError } from 'graphql';
import { verifyAccessToken } from '../../utils/jwt';

describe('Auth Mutations', () => {
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

  describe('register', () => {
    it('should register a new user and return access token', async () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'casual'
      };

      const result = await authMutations.register(null, { input });

      expect(result.accessToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.name).toBe(input.name);
      expect(result.user.email).toBe(input.email);
      expect(result.user.role).toBe(input.role);
      
      // Verify token is valid
      const decoded = verifyAccessToken(result.accessToken);
      expect(decoded?.email).toBe(input.email);
      expect(decoded?.role).toBe(input.role);
    });

    it('should hash password before storing', async () => {
      const input = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'plainPassword123',
        role: 'manager'
      };

      await authMutations.register(null, { input });

      const user = await UserModel.findOne({ email: input.email }).select('+password');
      expect(user?.password).toBeDefined();
      expect(user?.password).not.toBe(input.password); // Password should be hashed
      expect(user?.password).toMatch(/^\$2b\$/); // bcrypt hash format
    });

    it('should fail when email already exists', async () => {
      const input = {
        name: 'Duplicate User',
        email: 'duplicate@example.com',
        password: 'password123',
        role: 'casual'
      };

      // Register first time
      await authMutations.register(null, { input });

      // Try to register again with same email
      await expect(authMutations.register(null, { input }))
        .rejects
        .toThrow(GraphQLError);

      try {
        await authMutations.register(null, { input });
      } catch (error: any) {
        expect(error.extensions.code).toBe('EMAIL_ALREADY_IN_USE');
        expect(error.extensions.httpCode).toBe(400);
      }
    });

    it('should fail with invalid email format', async () => {
      const input = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123',
        role: 'casual'
      };

      await expect(authMutations.register(null, { input }))
        .rejects
        .toThrow(); // Zod validation error
    });

    it('should fail with short password', async () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: '12345', // Less than 6 characters
        role: 'casual'
      };

      await expect(authMutations.register(null, { input }))
        .rejects
        .toThrow(); // Zod validation error
    });

    it('should fail with short name', async () => {
      const input = {
        name: 'AB', // Less than 3 characters
        email: 'test@example.com',
        password: 'password123',
        role: 'casual'
      };

      await expect(authMutations.register(null, { input }))
        .rejects
        .toThrow(); // Zod validation error
    });

    it('should handle all valid roles', async () => {
      const roles: Array<'admin' | 'casual' | 'head' | 'manager'> = 
        ['admin', 'casual', 'head', 'manager'];

      for (const role of roles) {
        const input = {
          name: `${role} User`,
          email: `${role}@example.com`,
          password: 'password123',
          role
        };

        const result = await authMutations.register(null, { input });
        expect(result.user.role).toBe(role);
      }
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a test user
      await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'correctPassword',
        role: 'casual'
      });
    });

    it('should login with correct credentials', async () => {
      const input = {
        email: 'test@example.com',
        password: 'correctPassword'
      };

      const result = await authMutations.login(null, { input });

      expect(result.accessToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(input.email);
      expect(result.user.password).toBeUndefined(); // Password should not be returned
      
      // Verify token
      const decoded = verifyAccessToken(result.accessToken);
      expect(decoded?.email).toBe(input.email);
    });

    it('should fail with incorrect password', async () => {
      const input = {
        email: 'test@example.com',
        password: 'wrongPassword'
      };

      await expect(authMutations.login(null, { input }))
        .rejects
        .toThrow(GraphQLError);

      try {
        await authMutations.login(null, { input });
      } catch (error: any) {
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
        expect(error.message).toBe('Invalid email or password');
      }
    });

    it('should fail with non-existent email', async () => {
      const input = {
        email: 'nonexistent@example.com',
        password: 'anyPassword'
      };

      await expect(authMutations.login(null, { input }))
        .rejects
        .toThrow(GraphQLError);

      try {
        await authMutations.login(null, { input });
      } catch (error: any) {
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
        expect(error.message).toBe('Invalid email or password');
      }
    });

    it('should fail with invalid email format', async () => {
      const input = {
        email: 'invalid-email',
        password: 'password123'
      };

      await expect(authMutations.login(null, { input }))
        .rejects
        .toThrow(); // Zod validation error
    });

    it('should not expose whether email exists or password is wrong', async () => {
      const wrongEmail = {
        email: 'wrong@example.com',
        password: 'correctPassword'
      };

      const wrongPassword = {
        email: 'test@example.com',
        password: 'wrongPassword'
      };

      let error1Message = '';
      let error2Message = '';

      try {
        await authMutations.login(null, { input: wrongEmail });
      } catch (error: any) {
        error1Message = error.message;
      }

      try {
        await authMutations.login(null, { input: wrongPassword });
      } catch (error: any) {
        error2Message = error.message;
      }

      // Both should return the same message (security best practice)
      expect(error1Message).toBe(error2Message);
      expect(error1Message).toBe('Invalid email or password');
    });
  });
});