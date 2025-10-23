import { makeRedisMock, resetStore } from '../__mocks__/redisMock';

jest.mock('../../redis/redis', () => {
  const mock = require('../__mocks__/redisMock');
  return {
    redisClient: mock.makeRedisMock(),
  };
});

import { userRateLimiter } from '../../middleware/rateLimiter';
import { redisClient } from '../../redis/redis';

describe('checkUserTokenBudget()', () => {
  const userId = 'budget-user';

  beforeEach(() => {
    resetStore();
    jest.restoreAllMocks();
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

  test('handles Redis failures gracefully with fail-open', async () => {
    const evalSpy = jest
      .spyOn(redisClient, 'eval')
      .mockImplementation(() => {
        throw new Error('Redis failure');
      });

    const res = await userRateLimiter.checkUserTokenBudget(userId, 5000);

    // Fail-open: allow request during Redis outage to preserve UX
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(50000); // dailyLimit default
    expect(res.resetTime).toBeGreaterThan(Date.now());
    
    // No diagnostic flags on error path
    expect(res.exceededDaily).toBeUndefined();
    expect(res.exceededMonthly).toBeUndefined();

    evalSpy.mockRestore();
  });

  test('handles concurrent token budget requests correctly', async () => {
    const dailyLimit = 50000;
    const tokensPerRequest = 5000;
    const maxAllowed = Math.floor(dailyLimit / tokensPerRequest); // 10 requests
    const totalRequests = maxAllowed + 3; // 13 total: 10 allowed, 3 denied

    // Fire concurrent requests to test Lua script atomicity
    // Without atomic operations, race conditions could allow > dailyLimit consumption
    const requests = Array.from({ length: totalRequests }, () =>
      userRateLimiter.checkUserTokenBudget('concurrent-user', tokensPerRequest),
    );

    const results = await Promise.all(requests);
    const allowedRequests = results.filter((res) => res.allowed);
    const deniedRequests = results.filter((res) => !res.allowed);

    // CRITICAL: Exactly 10 requests should be allowed (10 × 5000 = 50k)
    // Redis Lua script ensures atomic INCRBY prevents race conditions
    expect(allowedRequests.length).toBe(maxAllowed);
    expect(deniedRequests.length).toBe(3);

    // Verify denied requests have diagnostic flags
    deniedRequests.forEach((res) => {
      expect(res.allowed).toBe(false);
      // Remaining should be less than tokens requested (not enough budget left)
      expect(res.remaining).toBeLessThan(tokensPerRequest);
      // Should have exceeded daily limit
      expect(res.exceededDaily).toBe(true);
      // Source should indicate which limit was hit
      expect(res.source).toBeTruthy();
      expect(['daily', 'monthly', 'both']).toContain(res.source);
    });

    // Verify at least one allowed request shows decreasing remaining budget
    const allowedWithRemaining = allowedRequests.filter((res) => res.remaining < dailyLimit);
    expect(allowedWithRemaining.length).toBeGreaterThan(0);
  });

  describe('diagnostic flags', () => {
    const dailyLimit = 50000;
    const monthlyLimit = 1000000;
    const dailyTTL = 3600; // 1h
    const monthlyTTL = 7200; // 2h

    test('daily-only exceeded', async () => {
      const tokensToUse = 100;
      const newDaily = dailyLimit - 10; // post-rollback value from Lua
      const newMonthly = monthlyLimit - 1000; // far from monthly limit
      jest.spyOn(redisClient as any, 'eval').mockResolvedValueOnce([
        0, newDaily, newMonthly, dailyTTL, monthlyTTL
      ]);

      const res = await userRateLimiter.checkUserTokenBudget('diag1', tokensToUse);
      expect(res.allowed).toBe(false);
      expect(res.exceededDaily).toBe(true);
      expect(res.exceededMonthly).toBe(false);
      expect(res.source).toBe('daily');
      expect(res.remaining).toBe(Math.min(dailyLimit - newDaily, monthlyLimit - newMonthly));
      expect(res.resetTime).toBeGreaterThan(Date.now());
    });

    test('monthly-only exceeded', async () => {
      const tokensToUse = 100;
      const newDaily = 200; // low daily usage
      const newMonthly = monthlyLimit - 50; // near monthly limit
      jest.spyOn(redisClient as any, 'eval').mockResolvedValueOnce([
        0, newDaily, newMonthly, dailyTTL, monthlyTTL
      ]);

      const res = await userRateLimiter.checkUserTokenBudget('diag2', tokensToUse);
      expect(res.allowed).toBe(false);
      expect(res.exceededDaily).toBe(false);
      expect(res.exceededMonthly).toBe(true);
      expect(res.source).toBe('monthly');
      expect(res.remaining).toBe(Math.min(dailyLimit - newDaily, monthlyLimit - newMonthly));
      expect(res.resetTime).toBeGreaterThan(Date.now());
    });

    test('both exceeded', async () => {
      const tokensToUse = 100;
      const newDaily = dailyLimit - 10;
      const newMonthly = monthlyLimit - 50;
      jest.spyOn(redisClient as any, 'eval').mockResolvedValueOnce([
        0, newDaily, newMonthly, dailyTTL, monthlyTTL
      ]);

      const res = await userRateLimiter.checkUserTokenBudget('diag3', tokensToUse);
      expect(res.allowed).toBe(false);
      expect(res.exceededDaily).toBe(true);
      expect(res.exceededMonthly).toBe(true);
      expect(res.source).toBe('both');
      expect(res.remaining).toBe(Math.min(dailyLimit - newDaily, monthlyLimit - newMonthly));
      expect(res.resetTime).toBeGreaterThan(Date.now());
    });

    test('edge-case equals limit (allowed)', async () => {
      const tokensToUse = 100;
      // Simulate success path from Lua: allowed=1 and counters include tokens
      const afterDaily = dailyLimit; // exactly hits daily limit
      const afterMonthly = 1000; // far from monthly limit
      jest.spyOn(redisClient as any, 'eval').mockResolvedValueOnce([
        1, afterDaily, afterMonthly, dailyTTL, monthlyTTL
      ]);

      const res = await userRateLimiter.checkUserTokenBudget('diag4', tokensToUse);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(Math.min(dailyLimit - afterDaily, monthlyLimit - afterMonthly));
      expect(res.resetTime).toBeGreaterThan(Date.now());
      // No exceeded flags on success path
      expect(res.exceededDaily).toBeUndefined();
      expect(res.exceededMonthly).toBeUndefined();
      expect(res.source).toBeUndefined();
    });
  });
});