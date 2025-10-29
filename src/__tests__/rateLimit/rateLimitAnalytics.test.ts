import { resetStore } from '../__mocks__/redisMock';

// Mock Redis to use in-memory mock instead of real connection
jest.mock('../../redis/redis', () => {
  const mock = require('../__mocks__/redisMock');
  return {
    redisClient: mock.makeRedisMock(),
  };
});

import { RateLimitAnalytics } from '../../middleware/rateLimitAnalytics';
import { redisClient } from '../../redis/redis';
import { rateLimiterHealth } from '../../middleware/rateLimiterHealth';

describe('RateLimitAnalytics', () => {
    let analytics: RateLimitAnalytics;

    beforeEach(() => {
        // Restore all mocks first (from previous test spies)
        jest.restoreAllMocks();
        
        // Reset in-memory mock store
        resetStore();
        
        // Clear all mocks to prevent spy contamination between tests
        jest.clearAllMocks();
        
        // Create fresh analytics instance
        analytics = new RateLimitAnalytics();
        
        // Reset circuit breaker state
        const health = rateLimiterHealth as any;
        health.circuitState = 'closed';
        health.failures = 0;
        health.lastFailureTime = 0;
        
        // Clear any existing timers
        if (health.halfOpenTimer) {
            clearTimeout(health.halfOpenTimer);
            health.halfOpenTimer = undefined;
        }
    });

    afterEach(() => {
        // Clear circuit breaker timer to prevent Jest hanging
        const health = rateLimiterHealth as any;
        if (health.halfOpenTimer) {
            clearTimeout(health.halfOpenTimer);
            health.halfOpenTimer = undefined;
        }
        
        // Restore all mocks to prevent spy contamination
        jest.restoreAllMocks();
    });


    describe('logViolation', () => {
        it('should log a violation successfully', async () => {
            await analytics.logViolation('user123', 'messages', 'free');

            const violationKey = 'rate_limit:violations:messages';
            const count = await redisClient.zcard(violationKey);
            expect(count).toBe(1);
        });

        it('should log multiple violations for same user', async () => {
            await analytics.logViolation('user123', 'messages', 'free');
            await analytics.logViolation('user123', 'messages', 'free');
            await analytics.logViolation('user123', 'conversations', 'free');

            const messagesKey = 'rate_limit:violations:messages';
            const conversationsKey = 'rate_limit:violations:conversations';
            
            const messagesCount = await redisClient.zcard(messagesKey);
            const conversationsCount = await redisClient.zcard(conversationsKey);
            
            expect(messagesCount).toBe(2);
            expect(conversationsCount).toBe(1);
        });

        it('should store tier information', async () => {
            await analytics.logViolation('user123', 'messages', 'premium');

            const violationKey = 'rate_limit:violations:messages';
            const members = await redisClient.zrange(violationKey, 0, -1) as string[];
            
            expect(members.length).toBe(1);
            expect(members[0]).toContain('user123:premium:');
        });

        it('should increment per-user counter', async () => {
            await analytics.logViolation('user123', 'messages', 'free');

            const userCounterKey = 'rate_limit:user_violations:user123';
            const entries = await redisClient.zrange(
                userCounterKey,
                0,
                -1,
                'WITHSCORES'
            ) as string[];
            
            expect(entries.length).toBeGreaterThan(0);
            const score = parseFloat(entries[1]);
            expect(score).toBe(1);
        });

        it('should handle unknown tier as default', async () => {
            await analytics.logViolation('user123', 'messages');

            const violationKey = 'rate_limit:violations:messages';
            const members = await redisClient.zrange(violationKey, 0, -1) as string[];
            
            expect(members[0]).toContain('user123:unknown:');
        });

        it('should skip logging when circuit is open', async () => {
            for (let i = 0; i < 5; i++) {
                rateLimiterHealth.recordFailure('rate-limit');
            }
            expect(rateLimiterHealth.isCircuitOpen()).toBe(true);

            await analytics.logViolation('user123', 'messages', 'free');

            const violationKey = 'rate_limit:violations:messages';
            const count = await redisClient.zcard(violationKey);
            expect(count).toBe(0);
        });

        it('should set expiration on keys', async () => {
            await analytics.logViolation('user123', 'messages', 'free');

            const violationKey = 'rate_limit:violations:messages';
            const ttl = await redisClient.ttl(violationKey);
            
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(30 * 24 * 60 * 60 + 1);
        });
    });

    describe('getUserViolationCount', () => {
        it('should return 0 for user with no violations', async () => {
            const count = await analytics.getUserViolationCount('user123', 24);
            expect(count).toBe(0);
        });

        it('should count violations correctly', async () => {
            await analytics.logViolation('user123', 'messages', 'free');
            await analytics.logViolation('user123', 'messages', 'free');
            await analytics.logViolation('user123', 'conversations', 'free');

            const count = await analytics.getUserViolationCount('user123', 24);
            expect(count).toBe(3);
        });

        it('should not count violations from other users', async () => {
            await analytics.logViolation('user123', 'messages', 'free');
            await analytics.logViolation('user456', 'messages', 'free');
            await analytics.logViolation('user456', 'messages', 'free');

            const count = await analytics.getUserViolationCount('user123', 24);
            expect(count).toBe(1);
        });

        it('should return 0 when circuit is open', async () => {
            await analytics.logViolation('user123', 'messages', 'free');

            for (let i = 0; i < 5; i++) {
                rateLimiterHealth.recordFailure('rate-limit');
            }

            const count = await analytics.getUserViolationCount('user123', 24);
            expect(count).toBe(0);
        });
    });

    describe('getTopViolators', () => {
        it('should return empty array when no violations', async () => {
            const result = await analytics.getTopViolators(24, 10);
            expect(result).toEqual([]);
        });

        it('should return top violators sorted by count', async () => {
            for (let i = 0; i < 5; i++) {
                await analytics.logViolation('user123', 'messages', 'free');
            }
            for (let i = 0; i < 3; i++) {
                await analytics.logViolation('user456', 'messages', 'premium');
            }
            for (let i = 0; i < 8; i++) {
                await analytics.logViolation('user789', 'conversations', 'free');
            }

            const result = await analytics.getTopViolators(24, 10);

            expect(result.length).toBe(3);
            expect(result[0].userId).toBe('user789');
            expect(result[0].count).toBe(8);
            expect(result[1].userId).toBe('user123');
            expect(result[1].count).toBe(5);
            expect(result[2].userId).toBe('user456');
            expect(result[2].count).toBe(3);
        });

        it('should include tier information', async () => {
            await analytics.logViolation('user123', 'messages', 'premium');
            await analytics.logViolation('user123', 'messages', 'premium');

            const result = await analytics.getTopViolators(24, 10);

            expect(result.length).toBe(1);
            expect(result[0].tier).toBe('premium');
        });

        it('should respect limit parameter', async () => {
            for (let i = 0; i < 15; i++) {
                await analytics.logViolation(`user${i}`, 'messages', 'free');
            }

            const result = await analytics.getTopViolators(24, 5);
            expect(result.length).toBe(5);
        });

        it('should aggregate violations across limit types', async () => {
            await analytics.logViolation('user123', 'messages', 'free');
            await analytics.logViolation('user123', 'messages', 'free');
            await analytics.logViolation('user123', 'conversations', 'free');

            const result = await analytics.getTopViolators(24, 10);

            expect(result.length).toBe(1);
            expect(result[0].userId).toBe('user123');
            expect(result[0].count).toBe(3);
        });

        it('should return empty array when circuit is open', async () => {
            await analytics.logViolation('user123', 'messages', 'free');

            for (let i = 0; i < 5; i++) {
                rateLimiterHealth.recordFailure('rate-limit');
            }

            const result = await analytics.getTopViolators(24, 10);
            expect(result).toEqual([]);
        });
    });

    describe('Error Handling', () => {
        it('should handle Redis errors in logViolation gracefully', async () => {
            const multiSpy = jest.spyOn(redisClient, 'multi').mockImplementationOnce(() => {
                throw new Error('Redis connection failed');
            });

            await expect(analytics.logViolation('user123', 'messages', 'free')).resolves.not.toThrow();
            
            multiSpy.mockRestore();
        });

        it('should handle Redis errors in getUserViolationCount gracefully', async () => {
            const zrangeSpy = jest.spyOn(redisClient, 'zrange').mockRejectedValueOnce(
                new Error('Redis timeout')
            );

            const count = await analytics.getUserViolationCount('user123', 24);
            expect(count).toBe(0);
            
            zrangeSpy.mockRestore();
        });

        it('should handle Redis errors in getTopViolators gracefully', async () => {
            const scanSpy = jest.spyOn(redisClient, 'scan').mockRejectedValueOnce(
                new Error('Redis connection lost')
            );

            const result = await analytics.getTopViolators(24, 10);
            expect(result).toEqual([]);
            
            scanSpy.mockRestore();
        });
    });
});