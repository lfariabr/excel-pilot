// __tests__/routes/users/mutations.test.ts
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../../app';
import { register404Handler } from '../../../graphql';
import UserModel from '../../../models/User';
import { signAccessToken } from '../../../utils/jwt';

describe('REST Users Mutations', () => {
  let app: express.Express;
  let mongoServer: MongoMemoryServer;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
    register404Handler(app);

    // Create auth user
    const user = await UserModel.create({
      name: 'Admin User',
      email: 'admin@mutations.com',
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
    // Clean up test data between tests (except auth user)
    await UserModel.deleteMany({ email: { $ne: 'admin@mutations.com' } });
  });

  describe('POST /users', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        name: 'New User',
        email: 'newuser@test.com',
        password: 'password123',
        role: 'casual'
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
      expect(response.body.role).toBe(userData.role);
      
      // Password should NOT be in response (security fix)
      expect(response.body).not.toHaveProperty('password');
    });

    it('should hash password before storing', async () => {
      const userData = {
        name: 'Hash Test',
        email: 'hash@test.com',
        password: 'plaintext123',
        role: 'casual'
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(201);

      // Fetch from DB directly to check hashed password
      const dbUser = await UserModel.findById(response.body._id).select('+password');
      expect(dbUser?.password).toBeDefined();
      expect(dbUser?.password).not.toBe('plaintext123'); // Should be hashed
      expect(dbUser?.password).toMatch(/^\$2b\$/); // bcrypt hash format
    });

    it('should return 400 when missing required fields', async () => {
      const invalidData = {
        name: 'Incomplete'
        // Missing email, password, role
      };

      const response = await request(app)
        .post('/users')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toMatch(/missing required fields/i);
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = {
        name: 'Bad Email',
        email: 'not-an-email',
        password: 'password123',
        role: 'casual'
      };

      const response = await request(app)
        .post('/users')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toMatch(/invalid email/i);
    });

    it('should return 400 for short password', async () => {
      const invalidData = {
        name: 'Short Pass',
        email: 'short@test.com',
        password: 'short',
        role: 'casual'
      };

      const response = await request(app)
        .post('/users')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toMatch(/8 characters/i);
    });

    it('should return 400 for invalid role', async () => {
      const invalidData = {
        name: 'Bad Role',
        email: 'role@test.com',
        password: 'password123',
        role: 'superadmin' // Invalid role
      };

      const response = await request(app)
        .post('/users')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toMatch(/invalid role/i);
    });

    it('should return 400 for duplicate email', async () => {
      const userData = {
        name: 'Duplicate Test',
        email: 'duplicate@test.com',
        password: 'password123',
        role: 'casual'
      };

      // Create first user
      await request(app)
        .post('/users')
        .send(userData)
        .expect(201);

      // Attempt to create duplicate
      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(400);

      expect(response.body.error).toMatch(/already exists/i);
    });

    it('should accept all valid roles', async () => {
      const roles = ['admin', 'casual', 'head', 'manager'];

      for (const role of roles) {
        const response = await request(app)
          .post('/users')
          .send({
            name: `${role} User`,
            email: `${role}@test.com`,
            password: 'password123',
            role
          })
          .expect(201);

        expect(response.body.role).toBe(role);
      }
    });
  });

  describe('PATCH /users/:id', () => {
    let targetUserId: string;

    beforeEach(async () => {
      const user = await UserModel.create({
        name: 'Patch Target',
        email: 'patch@test.com',
        password: 'password123',
        role: 'casual'
      });
      targetUserId = user._id?.toString() || '';
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .patch(`/users/${targetUserId}`)
        .send({ name: 'Updated' })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should update user name', async () => {
      const response = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.email).toBe('patch@test.com'); // Unchanged
    });

    it('should update user email', async () => {
      const response = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'newemail@test.com' })
        .expect(200);

      expect(response.body.email).toBe('newemail@test.com');
    });

    it('should update user role', async () => {
      const response = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'manager' })
        .expect(200);

      expect(response.body.role).toBe('manager');
    });

    it('should return 400 when trying to update password', async () => {
      const response = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'newpassword123' })
        .expect(400);

      expect(response.body.error).toMatch(/dedicated password/i);
    });

    it('should return 400 for invalid ObjectId', async () => {
      const response = await request(app)
        .patch('/users/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(400);

      expect(response.body.error).toMatch(/invalid/i);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .patch(`/users/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body.error).toMatch(/not found/i);
    });

    it('should update multiple fields at once', async () => {
      const response = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Multi Update',
          email: 'multi@test.com',
          role: 'head'
        })
        .expect(200);

      expect(response.body.name).toBe('Multi Update');
      expect(response.body.email).toBe('multi@test.com');
      expect(response.body.role).toBe('head');
    });

    it('should update updatedAt timestamp', async () => {
      const before = await UserModel.findById(targetUserId);
      const originalTimestamp = before?.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Timestamp Test' })
        .expect(200);

      expect(new Date(response.body.updatedAt).getTime())
        .toBeGreaterThan(new Date(originalTimestamp!).getTime());
    });
  });

  describe('DELETE /users/:id', () => {
    let targetUserId: string;

    beforeEach(async () => {
      const user = await UserModel.create({
        name: 'Delete Target',
        email: 'delete@test.com',
        password: 'password123',
        role: 'casual'
      });
      targetUserId = user._id?.toString() || '';
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .delete(`/users/${targetUserId}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should delete user and return ok: true', async () => {
      const response = await request(app)
        .delete(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);

      // Verify user is actually deleted
      const deleted = await UserModel.findById(targetUserId);
      expect(deleted).toBeNull();
    });

    it('should return ok: false for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/users/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for invalid ObjectId', async () => {
      const response = await request(app)
        .delete('/users/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toMatch(/invalid/i);
    });

    it('should completely remove user from database', async () => {
      await request(app)
        .delete(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const count = await UserModel.countDocuments({ _id: targetUserId });
      expect(count).toBe(0);
    });
  });
});