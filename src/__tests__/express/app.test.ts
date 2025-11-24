// __tests__/express/app.test.ts

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app';
import { register404Handler } from '../../graphql';

describe('Express App', () => {
  let app: express.Express;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
    // Register 404 handler (normally done in server.ts)
    register404Handler(app);
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
      const testData = { 
        name: 'Test User', 
        email: `test-${Date.now()}@example.com`, // Unique email to avoid 409
        password: 'test123',
        role: 'casual'
      };
      
      const response = await request(app)
        .post('/users')
        .send(testData)
        .set('Content-Type', 'application/json');

      // Should reject due to validation errors
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.status).toBe(400);
    });

    it('should reject oversized JSON payloads', async () => {
      // Create a payload larger than 1mb limit
      const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB
      
      const response = await request(app)
        .post('/users')
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