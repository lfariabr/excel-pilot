import { makeRedisMock, resetStore } from '../__mocks__/redisMock';

jest.mock('../../redis/redis', () => {
  const mock = require('../__mocks__/redisMock');
  return {
    redisClient: mock.makeRedisMock(),
  };
});

import { userRateLimiter } from '../../middleware/rateLimiter';

describe('checkUserTokenBudget()', () => {
  const userId = 'budget-user';

  beforeEach(() => {
    resetStore();
  });

  test('allows within both daily and monthly limits', async () => {
    const res = await userRateLimiter.checkUserTokenBudget(userId, 1000);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBeGreaterThan(0);
    expect(res.resetTime).toBeGreaterThan(Date.now());
  });

  test('denies when exceeding daily limit and rolls back', async () => {
    // Push to daily 50k limit exactly
    await userRateLimiter.checkUserTokenBudget('d1', 50000);
    // Next request should exceed and be denied + rolled back
    const deny = await userRateLimiter.checkUserTokenBudget('d1', 1000);
    expect(deny.allowed).toBe(false);
    // After rollback, we should be back at 50k, so a small request still denied
    const small = await userRateLimiter.checkUserTokenBudget('d1', 500);
    expect(small.allowed).toBe(false);
    // But if we reset, a fresh request should work
    const fresh = await userRateLimiter.checkUserTokenBudget('d2', 500);
    expect(fresh.allowed).toBe(true);
  });

  test('denies when exceeding daily limit (which also protects monthly) and rolls back', async () => {
    // Try to use 1M tokens in one call - exceeds daily 50k limit
    const huge = await userRateLimiter.checkUserTokenBudget('m1', 1000000);
    expect(huge.allowed).toBe(false); // denied because > 50k daily
    // After rollback, counters are back to 0, so small request should work
    const small = await userRateLimiter.checkUserTokenBudget('m1', 1000);
    expect(small.allowed).toBe(true);
  });

  test('allows incremental usage up to limit, then denies and rolls back', async () => {
    // Use tokens incrementally up to just under daily limit
    const r1 = await userRateLimiter.checkUserTokenBudget('inc1', 25000);
    expect(r1.allowed).toBe(true);
    const r2 = await userRateLimiter.checkUserTokenBudget('inc1', 24000);
    expect(r2.allowed).toBe(true); // total: 49k
    // Next request would exceed
    const r3 = await userRateLimiter.checkUserTokenBudget('inc1', 2000);
    expect(r3.allowed).toBe(false); // would be 51k > 50k → denied + rolled back
    // After rollback, should be back at 49k
    const r4 = await userRateLimiter.checkUserTokenBudget('inc1', 1000);
    expect(r4.allowed).toBe(true); // 49k + 1k = 50k exactly (allowed)
  });
});