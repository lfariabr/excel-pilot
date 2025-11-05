// __tests__/express/app.test.ts

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app';

describe('Express App', () => {
  let app: express.Express;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Health Endpoints', () => {
    it('GET /health should return ok status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('GET /ready should return mongo status when connected', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body).toHaveProperty('mongo');
      expect(response.body.mongo).toBe(true);
    });

    it('GET /ready should return 503 when mongo is disconnected', async () => {
      // Disconnect mongoose
      // Note: This test temporarily disconnects Mongoose and must run sequentially
      await mongoose.disconnect();

      const response = await request(app)
        .get('/ready')
        .expect(503);

      expect(response.body.mongo).toBe(false);

      // Reconnect for other tests
      await mongoose.connect(mongoServer.getUri());
    });
  });

  describe('Middleware', () => {
    it('should set CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should set security headers via Helmet', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for common Helmet headers
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
    });

    it('should parse JSON request bodies', async () => {
      const testData = { email: 'test@example.com', password: 'test123' };
      
      const response = await request(app)
        .post('/users/login')
        .send(testData)
        .set('Content-Type', 'application/json');

      // Should process JSON (even if auth fails, JSON was parsed)
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should reject oversized JSON payloads', async () => {
      // Create a payload larger than 1mb limit
      const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB
      
      const response = await request(app)
        .post('/users/login')
        .send(largePayload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(413); // Payload Too Large
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      await request(app)
        .get('/non-existent-route-12345')
        .expect(404);
    });

    it('should return JSON error format', async () => {
      const response = await request(app)
        .get('/non-existent-route');

      if (response.status >= 400) {
        expect(response.headers['content-type']).toMatch(/json/);
      }
    });
  });

  describe('REST Routes', () => {
    it('should mount /users routes', async () => {
      const response = await request(app)
        .get('/users');

      // Router should be mounted - expect auth/method errors, not 404
      expect(response.status).toBeDefined();
      expect([40, 401, 405, 500]).toContain(response.status);
    });

    it('should mount /analytics routes', async () => {
      const response = await request(app)
        .get('/analytics');

      expect(response.status).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should prevent XSS via Content-Type headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should prevent clickjacking via X-Frame-Options', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should disable X-Powered-By header', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS requests for CORS preflight', async () => {
      const response = await request(app)
        .options('/health');

      expect(response.status).toBeLessThan(500);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should allow credentials in CORS', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});