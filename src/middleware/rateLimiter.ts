import { redisClient } from '../redis';
import { rateLimitConfig } from '../config/rateLimit.config';
import { RateLimitResult } from '../schemas/types/rateLimitTypes';

export class UserRateLimiter {
    /**
     * This is responsible for checking if user can make a request
     * @param userId - user ID from JWT token
     * @param limitType - type of limit (if openai or messages)
     */

    async checkUserLimit(userId: string, limitType: 'openai' | 'messages'): Promise<RateLimitResult> {
        // Lua script: atomic INCR + conditional EXPIRE
        // Guarantees TTL is set even on race conditions (count === 1 or crash before EXPIRE)
        // TTL fallback: ensures consistent resetTime even if Redis TTL was missing or 0
        const key = `rateLimit:${userId}:${limitType}`;
        const config = rateLimitConfig[limitType];
        
        try {
            const script = `
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end

            local ttl = redis.call('TTL', KEYS[1])
            if ttl == -1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
                ttl = tonumber(ARGV[1])
            end
            
            return {count, ttl}
            `;
            const [newCount, ttl] = await redisClient.eval(
                script,
                1,
                key,
                Math.floor(config.windowMs / 1000)
            ) as [number, number];

            if (newCount > config.max) {
                const safeTTL = Number.isFinite(ttl) && ttl > 0 ? ttl : Math.floor(config.windowMs / 1000);
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: Date.now() + (safeTTL * 1000)
                };
            }

            const safeTTL = Number.isFinite(ttl) && ttl > 0 ? ttl : Math.floor(config.windowMs / 1000);
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
        // Lua script: atomic INCRBY + TTL repair + rollback if over daily/monthly limits
        // Eliminates race conditions and TOCTOU problems by executing logic server-side
        const dailyKey = `token_budget:daily:${userId}`;
        const monthlyKey = `token_budget:monthly:${userId}`;

        // budget limits
        const dailyLimit = 50000; // 50k tokens per day (~$1.00)
        const monthlyLimit = 1000000; // 1M tokens per month (~$20.00)

        try {
            // Rollback logic: if either limit is exceeded, reverts token usage immediately
            // TTL repair after rollback: ensures key won't become zombie (no expiration)
            // Remaining is computed using post-decrement values to reflect accurate state
            const script = `
            local dailyKey = KEYS[1]
            local monthlyKey = KEYS[2]
            local tokens = tonumber(ARGV[1])
            local dailyLimit = tonumber(ARGV[2])
            local monthlyLimit = tonumber(ARGV[3])
            local dailyTTLSeconds = tonumber(ARGV[4])
            local monthlyTTLSeconds = tonumber(ARGV[5])

            -- increment both counters
            local daily = redis.call('INCRBY', dailyKey, tokens)
            local monthly = redis.call('INCRBY', monthlyKey, tokens)

            -- ensure TTLs exist or repair missing TTLs
            local dttl = redis.call('TTL', dailyKey)
            if dttl == -1 then
                redis.call('EXPIRE', dailyKey, dailyTTLSeconds)
                dttl = dailyTTLSeconds
            end
            
            local mttl = redis.call('TTL', monthlyKey)
            if mttl == -1 then
                redis.call('EXPIRE', monthlyKey, monthlyTTLSeconds)
                mttl = monthlyTTLSeconds
            end

            -- check limits
            local exceededDaily = (daily > dailyLimit)
            local exceededMonthly = (monthly > monthlyLimit)
            if exceededDaily or exceededMonthly then
                -- rollback both counters atomically within the script
                redis.call('DECRBY', dailyKey, tokens)
                redis.call('DECRBY', monthlyKey, tokens)
                -- read post-rollback values
                local dval = tonumber(redis.call('GET', dailyKey) or '0')
                local mval = tonumber(redis.call('GET', monthlyKey) or '0')
                -- ensure TTLs after rollback
                dttl = redis.call('TTL', dailyKey)
            if dttl == -1 then
                redis.call('EXPIRE', dailyKey, dailyTTLSeconds)
                dttl = dailyTTLSeconds
            end

            mttl = redis.call('TTL', monthlyKey)
            if mttl == -1 then
                redis.call('EXPIRE', monthlyKey, monthlyTTLSeconds)
                mttl = monthlyTTLSeconds
            end

            return {0, dval, mval, dttl, mttl}
            end

            return {1, daily, monthly, dttl, mttl}
            `;

            const [allowedNum, newDaily, newMonthly, dailyTTL, monthlyTTL] = await redisClient.eval(
                script,
                2,
                dailyKey,
                monthlyKey,
                tokensToUse,
                dailyLimit,
                monthlyLimit,
                24 * 60 * 60,
                30 * 24 * 60 * 60
            ) as [number, number, number, number, number];

            const safeDailyTTL = Number.isFinite(dailyTTL) && dailyTTL > 0 ? dailyTTL : 24 * 60 * 60;
            const safeMonthlyTTL = Number.isFinite(monthlyTTL) && monthlyTTL > 0 ? monthlyTTL : 30 * 24 * 60 * 60;

            if (!allowedNum) {
                return {
                    allowed: false,
                    remaining: Math.min(
                        Math.max(0, dailyLimit - newDaily),
                        Math.max(0, monthlyLimit - newMonthly)
                    ),
                    resetTime: Date.now() + (Math.min(safeDailyTTL, safeMonthlyTTL) * 1000)
                };
            }

            return {
                allowed: true,
                remaining: Math.min(
                    Math.max(0, dailyLimit - newDaily),
                    Math.max(0, monthlyLimit - newMonthly)
                ),
                resetTime: Date.now() + (Math.min(safeDailyTTL, safeMonthlyTTL) * 1000)
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