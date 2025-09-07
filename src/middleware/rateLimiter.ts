import { redisClient } from '../redis';

export const rateLimitConfig = {
    openai: { windowMs: 60 * 1000, max: 10, }, // 10 requests per minute (window)
    messages: { windowMs: 60 * 1000, max: 30,} // 30 requests per minute (window)
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
            // get current count
            const currentCount = await redisClient.get(key);
            const count = currentCount ? parseInt(currentCount) : 0;

            // check if limit is exceeded
            if (count >= config.max) {
                const ttl = await redisClient.ttl(key);
                // TTL tells us how many seconds are left, when the window resets
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: Date.now() + (ttl * 1000)
                };
            }

            //  Increment counter (creates if doesn't exist)
            // INCR is atomic - no race conditions!!!
            const newCount = await redisClient.incr(key);
            
            // set expiration on the first request
            if (newCount === 1) {
                await redisClient.expire(key, config.windowMs / 1000);
            }

            return {
                allowed: true,
                remaining: config.max - newCount,
                resetTime: Date.now() + config.windowMs,
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
        const dailyLimit = 100000; // 50k tokens per day (~$1.00)
        const monthlyLimit = 1000000; // 1M tokens per month (~$20.00)

        try {
            // get current usage
            const [dailyUsed, monthlyUsed] = await Promise.all([
                redisClient.get(dailyKey).then(val => parseInt(val || '0')),
                redisClient.get(monthlyKey).then(val => parseInt(val || '0')),
            ]);

            // check if adding tokens will exceed limits
            if (dailyUsed + tokensToUse > dailyLimit) {
                const ttl = await redisClient.ttl(dailyKey);
                return {
                    allowed: false,
                    remaining: Math.max(0, dailyLimit - dailyUsed),
                    resetTime: Date.now() + (ttl * 1000)
                };
            }

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

            return {
                allowed: true,
                remaining: Math.min(
                    dailyLimit - (dailyUsed + tokensToUse),
                    monthlyLimit - (monthlyUsed + tokensToUse)
                ),
                resetTime: Date.now() + (24 * 60 * 60 * 1000)
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