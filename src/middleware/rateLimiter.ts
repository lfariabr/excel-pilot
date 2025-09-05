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
}

export const userRateLimiter = new UserRateLimiter();