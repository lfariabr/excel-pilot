// __tests__/routes/auth/mutations.test.ts
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../../app';
import { register404Handler } from '../../../graphql';
import UserModel from '../../../models/User';
import { verifyAccessToken } from '../../../utils/jwt';

describe('REST Auth Mutations', () => {
  let app: express.Express;
  let mongoServer: MongoMemoryServer;

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
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return access token', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'casual'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe(userData.role);
      expect(response.body.user).not.toHaveProperty('password');

      // Verify token is valid
      const decoded = verifyAccessToken(response.body.accessToken);
      expect(decoded?.email).toBe(userData.email);
      expect(decoded?.role).toBe(userData.role);
    });

    it('should hash password before storing', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@hash.com',
        password: 'plaintext123',
        role: 'casual'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const dbUser = await UserModel.findById(response.body.user._id).select('+password');
      expect(dbUser?.password).toBeDefined();
      expect(dbUser?.password).not.toBe('plaintext123');
      expect(dbUser?.password).toMatch(/^\$2b\$/);
    });

    it('should return 400 when missing required fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ name: 'Incomplete' })
        .expect(400);

      expect(response.body.error).toMatch(/missing required fields/i);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          password: 'password123',
          role: 'casual'
        })
        .expect(400);

      expect(response.body.error).toMatch(/invalid email/i);
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'Short Pass',
          email: 'short@test.com',
          password: 'short',
          role: 'casual'
        })
        .expect(400);

      expect(response.body.error).toMatch(/8 characters/i);
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'Bad Role',
          email: 'role@test.com',
          password: 'password123',
          role: 'superadmin'
        })
        .expect(400);

      expect(response.body.error).toMatch(/invalid role/i);
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        name: 'Duplicate Test',
        email: 'duplicate@test.com',
        password: 'password123',
        role: 'casual'
      };

      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toMatch(/already exists/i);
    });

    it('should accept all valid roles', async () => {
      const roles = ['admin', 'casual', 'head', 'manager'];

      for (const role of roles) {
        const response = await request(app)
          .post('/auth/register')
          .send({
            name: `${role} User`,
            email: `${role}@test.com`,
            password: 'password123',
            role
          })
          .expect(201);

        expect(response.body.user.role).toBe(role);
      }
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create test user for login tests
      await UserModel.create({
        name: 'Test User',
        email: 'test@login.com',
        password: 'password123',
        role: 'casual'
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@login.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@login.com');
      expect(response.body.user).not.toHaveProperty('password');

      // Verify token
      const decoded = verifyAccessToken(response.body.accessToken);
      expect(decoded?.email).toBe('test@login.com');
    });

    it('should return 400 when missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ password: 'password123' })
        .expect(400);

      expect(response.body.error).toMatch(/email and password/i);
    });

    it('should return 400 when missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@login.com' })
        .expect(400);

      expect(response.body.error).toMatch(/email and password/i);
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@login.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    it('should not expose whether user exists', async () => {
      const response1 = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        });

      const response2 = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@login.com',
          password: 'wrongpassword'
        });

      // Both should return same error message
      expect(response1.body.error).toBe(response2.body.error);
      expect(response1.status).toBe(401);
      expect(response2.status).toBe(401);
    });
  });
});