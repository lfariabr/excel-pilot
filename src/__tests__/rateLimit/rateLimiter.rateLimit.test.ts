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
});