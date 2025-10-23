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
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    jest.useFakeTimers({ now: Date.now() });
    try {
      // Consume up to the limit
      for (let i = 0; i < max; i++) {
        const res = await userRateLimiter.checkUserLimit(userId, limitType);
        expect(res.allowed).toBe(true);
      }

      // Simulate time passage for the window reset
      jest.advanceTimersByTime(windowMs);

      // After reset, the limit should allow requests again
      const res = await userRateLimiter.checkUserLimit(userId, limitType);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(max - 1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('handles Redis failures gracefully', async () => {
    const { redisClient } = require('../../redis/redis');
    const evalSpy = jest
      .spyOn(redisClient, 'eval')
      .mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

    const res = await userRateLimiter.checkUserLimit(userId, limitType);

    // Fail-closed: deny request with no remaining capacity
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);

    evalSpy.mockRestore();
  });

  test('handles concurrent requests correctly', async () => {
    // Create more than max requests to test over-limit behavior
    const totalRequests = max + 3;
    const requests = Array.from({ length: totalRequests }, () =>
      userRateLimiter.checkUserLimit(userId, limitType),
    );

    const results = await Promise.all(requests);
    const allowedRequests = results.filter((res) => res.allowed);

    // Exactly max requests should be allowed
    expect(allowedRequests.length).toBe(max);

    // Redis INCR is atomic and serializes concurrent requests
    // The first max requests should be allowed, remaining 3 should be denied
    const deniedRequests = results.filter((res) => !res.allowed);
    expect(deniedRequests.length).toBe(3);

    // All denied requests should have remaining: 0
    deniedRequests.forEach((res) => {
      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
    });
  });
});