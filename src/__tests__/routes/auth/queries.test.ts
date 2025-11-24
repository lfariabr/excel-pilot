// __tests__/routes/auth/queries.test.ts
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../../app';
import { register404Handler } from '../../../graphql';
import UserModel from '../../../models/User';
import { signAccessToken } from '../../../utils/jwt';

describe('REST Auth Queries', () => {
  let app: express.Express;
  let mongoServer: MongoMemoryServer;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
    register404Handler(app);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
    
    // Create test user
    const user = await UserModel.create({
      name: 'Test User',
      email: 'test@me.com',
      password: 'password123',
      role: 'admin'
    });
    testUserId = (user._id as mongoose.Types.ObjectId).toString();
    authToken = signAccessToken({
      sub: (user._id as mongoose.Types.ObjectId).toString(),
      email: user.email,
      role: user.role
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return current user when authenticated', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id', testUserId);
      expect(response.body).toHaveProperty('name', 'Test User');
      expect(response.body).toHaveProperty('email', 'test@me.com');
      expect(response.body).toHaveProperty('role', 'admin');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return 404 if user deleted after token issued', async () => {
      // Delete user
      await UserModel.findByIdAndDelete(testUserId);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toMatch(/not found/i);
    });
  });
});