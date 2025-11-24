// __tests__/routes/users/queries.test.ts
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../../app';
import { register404Handler } from '../../../graphql';
import UserModel from '../../../models/User';
import { signAccessToken } from '../../../utils/jwt';

describe('REST Users Queries', () => {
  let app: express.Express;
  let mongoServer: MongoMemoryServer;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
    register404Handler(app);

    // Create test user and generate token
    const user = await UserModel.create({
      name: 'Test User',
      email: 'test@queries.com',
      password: 'password123',
      role: 'admin'
    });
    testUserId = user?._id?.toString() || '';
    authToken = signAccessToken({
      sub: user._id?.toString() || '',
      email: user.email || '',
      role: user.role || 'user'
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up test data between tests (except the auth user)
    await UserModel.deleteMany({ email: { $ne: 'test@queries.com' } });
  });

  describe('GET /users', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/users')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return empty array when no users exist', async () => {
      // Delete all users EXCEPT auth user
      await UserModel.deleteMany({ email: { $ne: 'test@queries.com' } });

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1); // Only auth user remains
    });

    it('should list all users when authenticated', async () => {
      // Create additional test users
      await UserModel.create([
        { name: 'User 1', email: 'user1@test.com', password: 'pass123', role: 'casual' },
        { name: 'User 2', email: 'user2@test.com', password: 'pass123', role: 'manager' }
      ]);

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3); // 2 new + 1 auth user
      // ... rest of test
      expect(response.body[0]).toHaveProperty('_id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('email');
      expect(response.body[0]).toHaveProperty('role');
      
      // Password should NOT be returned (select: false in schema)
      expect(response.body[0]).not.toHaveProperty('password');
    });

    it('should return users with timestamps', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body[0]).toHaveProperty('createdAt');
      expect(response.body[0]).toHaveProperty('updatedAt');
    });
  });

  describe('GET /users/:id', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get(`/users/${testUserId}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/users/invalid-id-123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toMatch(/invalid/i);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/users/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toMatch(/not found/i);
    });

    it('should return user by ID when authenticated', async () => {
      const response = await request(app)
        .get(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id', testUserId);
      expect(response.body).toHaveProperty('name', 'Test User');
      expect(response.body).toHaveProperty('email', 'test@queries.com');
      expect(response.body).toHaveProperty('role', 'admin');
      
      // Password should NOT be returned
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return user with all expected fields', async () => {
      const response = await request(app)
        .get(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      expect(response.body).toHaveProperty('__v');
    });
  });

  describe('Query Performance', () => {
    it('should handle large user list efficiently', async () => {
      // Create 100 test users
      const users = Array.from({ length: 100 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@perf.com`,
        password: 'pass123',
        role: 'casual'
      }));
      await UserModel.insertMany(users);

      const startTime = Date.now();
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const duration = Date.now() - startTime;

      expect(response.body.length).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });
  });
});