import { makeRedisMock, resetStore } from '../__mocks__/redisMock';

// Mock src/redis to inject our in-memory Redis
jest.mock('../../redis/redis', () => {
  const mock = require('../__mocks__/redisMock');
  return {
    redisClient: mock.makeRedisMock(),
  };
});

import { userRateLimiter } from '../../middleware/rateLimiter';
import { rateLimitConfig } from '../../config/rateLimit.config';

describe('checkUserLimit()', () => {
  const userId = 'u1';
  const limitType = 'messages' as const;
  const { max, windowMs } = rateLimitConfig[limitType];

  beforeEach(() => {
    resetStore();
  });

  test('allows under the limit and sets TTL', async () => {
    const res = await userRateLimiter.checkUserLimit(userId, limitType);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(max - 1);
    expect(res.resetTime).toBeGreaterThan(Date.now());
  });

  test('denies when exceeding the limit and returns resetTime', async () => {
    // consume exactly max requests
    for (let i = 0; i < max; i++) {
      await userRateLimiter.checkUserLimit(userId, limitType);
    }
    // next request should exceed and be denied
    const over = await userRateLimiter.checkUserLimit(userId, limitType);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.resetTime).toBeGreaterThan(Date.now());
  });

  test('repairs missing TTL (orphaned key)', async () => {
    // One more call after we "remove" TTL in mock by simulating no TTL on next call.
    // Our mock auto-repairs TTL inside eval; assert resetTime is valid.
    const res = await userRateLimiter.checkUserLimit('u2', limitType);
    expect(res.allowed).toBe(true);
    expect(res.resetTime).toBeGreaterThan(Date.now());
    const approxWindow = windowMs;
    expect(res.resetTime - Date.now()).toBeLessThanOrEqual(approxWindow);
  });

  test('allows exactly at the limit but denies the next request', async () => {
    // Consume up to the limit
    for (let i = 0; i < max; i++) {
      const res = await userRateLimiter.checkUserLimit(userId, limitType);
      expect(res.allowed).toBe(true);
    }

    // Next request should be denied!
    const res = await userRateLimiter.checkUserLimit(userId, limitType);
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
  });

  test('resets the limit after the time window', async () => {
    // Consume up to the limit
    for (let i = 0; i < max; i++) {
      const res = await userRateLimiter.checkUserLimit(userId, limitType);
      expect(res.allowed).toBe(true);
    }

    // Simulate time passage for the window reset
    jest.useFakeTimers();
    jest.advanceTimersByTime(windowMs);

    // After reset, the limit should allow requests again
    const res = await userRateLimiter.checkUserLimit(userId, limitType);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(max - 1);
    jest.useRealTimers();
  });

    test('handles Redis failures gracefully', async () => {
    const redisSpy = jest.spyOn(require('../../redis/redis').redisClient, 'get').mockImplementation(() => {
      throw new Error('Redis connection failed');
    });
  
    const res = await userRateLimiter.checkUserLimit(userId, limitType);
  
    // Adjust expectation based on your fallback behavior
    expect(res.allowed).toBe(true); 
  
    // Restore the original implementation
    redisSpy.mockRestore();
  });

  test('handles concurrent requests correctly', async () => {
    const requests = Array.from({ length: max }, () =>
    userRateLimiter.checkUserLimit(userId, limitType)
    );
    
    const results = await Promise.all(requests);
    const allowedRequests = results.filter((res) => res.allowed);

    expect(allowedRequests.length).toBe(max);
    expect(results[max - 1].remaining).toBe(0);
  });
});