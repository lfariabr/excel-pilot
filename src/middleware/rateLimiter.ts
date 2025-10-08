import { redisClient } from '../redis';

export const rateLimitConfig = {
    openai: { 
        windowMs: 60 * 1000,
        max: 10, // 10 requests per minute (window)
    }, 
    messages: { 
        windowMs: 60 * 1000, 
        max: 30, // 30 requests per minute (window)
    }, 
};

// Rate limit result interface
interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
}

export class UserRateLimiter {
    /**
     * This is responsible for checking if user can make a request
     * @param userId - user ID from JWT token
     * @param limitType - type of limit (if openai or messages)
     */

    async checkUserLimit(userId: string, limitType: 'openai' | 'messages'): Promise<RateLimitResult> {
        const key = `rateLimit:${userId}:${limitType}`;
        const config = rateLimitConfig[limitType];
        
        try {
            // pre-check removed to avoid extra RTT; rely on INCR-first + TTL-based decisions

            //  Increment counter (creates if doesn't exist)
            // INCR is atomic - no race conditions!!!
            const newCount = await redisClient.incr(key);
            
            // First use in this window: attach the window TTL so the counter auto-resets
            if (newCount === 1) {
                await redisClient.expire(key, config.windowMs / 1000);
            }
            
            // If increment pushed us over the limit (races/concurrency), deny and return time until reset!
            if (newCount > config.max) {
                const ttl = await redisClient.ttl(key);
                const safeTTL = Number.isFinite(ttl) && ttl > 0 ? ttl : config.windowMs / 1000;
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: Date.now() + (safeTTL * 1000)
                };
            }

            // Within limit: report remaining quota and when the window actually expires (key TTL)
            const ttl = await redisClient.ttl(key);
            const safeTTL = Number.isFinite(ttl) && ttl > 0 ? ttl : config.windowMs / 1000;

            return {
                allowed: true,
                remaining: Math.max(0, config.max - newCount),
                resetTime: Date.now() + (safeTTL * 1000),
            };

        } catch (error) {
            console.error('Rate limiter error:', error);
            return {
                allowed: false,
                remaining: config.max,
                resetTime: Date.now() + config.windowMs,
            };
        }
    }

    /**
     * This will be responsible to check and update token budget for an user
     * @param userId - user ID from JWT token
     * @param tokensToUse - estimated or actual tokens to consume
     */
    async checkUserTokenBudget(userId: string, tokensToUse: number): Promise<RateLimitResult> {
        const dailyKey = `token_budget:daily:${userId}`;
        const monthlyKey = `token_budget:monthly:${userId}`;

        // budget limits
        const dailyLimit = 50000; // 50k tokens per day (~$1.00)
        const monthlyLimit = 1000000; // 1M tokens per month (~$20.00)

        try {
            // get current usage
            const [dailyUsed, monthlyUsed] = await Promise.all([
                redisClient.get(dailyKey).then(val => parseInt(val || '0')),
                redisClient.get(monthlyKey).then(val => parseInt(val || '0')),
            ]);

            // Pre-check against current usage: if this request would exceed daily budget, deny now
            if (dailyUsed + tokensToUse > dailyLimit) {
                const ttl = await redisClient.ttl(dailyKey);
                return {
                    allowed: false,
                    remaining: Math.max(0, dailyLimit - dailyUsed),
                    resetTime: Date.now() + (ttl * 1000)
                };
            }

            // Pre-check against current usage: if this request would exceed monthly budget, deny now
            if (monthlyUsed + tokensToUse > monthlyLimit) {
                const ttl = await redisClient.ttl(monthlyKey);
                return {
                    allowed: false,
                    remaining: Math.max(0, monthlyLimit - monthlyUsed),
                    resetTime: Date.now() + (ttl * 1000)
                };
            }

            // update token usage
            const pipeline = redisClient.pipeline();
            pipeline.incrby(dailyKey, tokensToUse);
            pipeline.expire(dailyKey, 24 * 60 * 60); // 1 day
            pipeline.incrby(monthlyKey, tokensToUse);
            pipeline.expire(monthlyKey, 30 * 24 * 60 * 60); // 30 days
            await pipeline.exec();

            // Post-increment verification: read updated usage and TTLS
            // Rationale: other concurrent requests may have incremented between our read and write!
            const [newDailyStr, newMonthlyStr, dailyTTL, monthlyTTL] = await Promise.all([
                redisClient.get(dailyKey),
                redisClient.get(monthlyKey),
                redisClient.ttl(dailyKey),
                redisClient.ttl(monthlyKey),
            ]);
            const newDaily = parseInt(newDailyStr || '0');
            const newMonthly = parseInt(newMonthlyStr || '0');
            const safeDailyTTL = Number.isFinite(dailyTTL) && dailyTTL > 0 ? dailyTTL : 24 * 60 * 60;
            const safeMonthlyTTL = Number.isFinite(monthlyTTL) && monthlyTTL > 0 ? monthlyTTL : 30 * 24 * 60 * 60;

            if (newDaily > dailyLimit || newMonthly > monthlyLimit) {
                const rb = redisClient.pipeline();
                if (newDaily > dailyLimit) rb.decrby(dailyKey, tokensToUse);
                if (newMonthly > monthlyLimit) rb.decrby(monthlyKey, tokensToUse);
                await rb.exec();

                if (newDaily > dailyLimit && newMonthly > monthlyLimit) {
                    const resetMs = Math.min(safeDailyTTL, safeMonthlyTTL) * 1000;
                    return {
                        allowed: false,
                        remaining: 0,
                        resetTime: Date.now() + resetMs,
                    };
                }
                if (newDaily > dailyLimit) {
                    return {
                        allowed: false,
                        remaining: Math.max(0, dailyLimit - (newDaily - tokensToUse)),
                        resetTime: Date.now() + (safeDailyTTL * 1000)
                    };
                }
                return {
                    allowed: false,
                    remaining: Math.max(0, monthlyLimit - (newMonthly - tokensToUse)),
                    resetTime: Date.now() + (safeMonthlyTTL * 1000)
                };
            }

            // Allowed: compute remaining from new values and use TTL-based resetTime
            return {
                allowed: true,
                remaining: Math.min(
                    dailyLimit - newDaily,
                    monthlyLimit - newMonthly
                ),
                resetTime: Date.now() + (safeDailyTTL * 1000)
            }

            
        } catch (error) {
            console.error('Token budget error:', error);
            // Fail open
            return {
                allowed: true,
                remaining: dailyLimit,
                resetTime: Date.now() + (24 * 60 * 60 * 1000)
            }
        }
    }
}

export const userRateLimiter = new UserRateLimiter();