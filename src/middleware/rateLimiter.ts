import { redisClient } from '../redis/redis';
import { rateLimitConfig } from '../config/rateLimit.config';
import { RateLimitResult } from '../schemas/types/rateLimitTypes';

// Load Lua scripts
import { loadLuaScript } from '../redis/loadScript';
const checkUserLimitScript = loadLuaScript('checkUserLimit.lua');
const tokenBudgetScript = loadLuaScript('tokenBudget.lua');

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
            const [newCount, ttl] = await redisClient.eval(
                // Lua script: atomic INCR + conditional EXPIRE
                // Guarantees TTL is set even on race conditions (count === 1 or crash before EXPIRE)
                // TTL fallback: ensures consistent resetTime even if Redis TTL was missing or 0
                checkUserLimitScript,
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
            
            const [allowedNum, newDaily, newMonthly, dailyTTL, monthlyTTL] = await redisClient.eval(
                // Rollback logic: if either limit is exceeded, reverts token usage immediately
                // TTL repair after rollback: ensures key won't become zombie (no expiration)
                // Remaining is computed using post-decrement values to reflect accurate state
                tokenBudgetScript,
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
                const attemptedDaily = newDaily + tokensToUse;
                const attemptedMonthly = newMonthly + tokensToUse;
                const exceededDaily = attemptedDaily > dailyLimit;
                const exceededMonthly = attemptedMonthly > monthlyLimit;

                const source = exceededDaily && exceededMonthly
                ? 'both'
                : exceededDaily
                ? 'daily'
                : exceededMonthly
                ? 'monthly'
                : 'none';

                return {
                    allowed: false,
                    remaining: Math.min(
                        Math.max(0, dailyLimit - newDaily),
                        Math.max(0, monthlyLimit - newMonthly)
                    ),
                    resetTime: Date.now() + (Math.min(safeDailyTTL, safeMonthlyTTL) * 1000),
                    exceededDaily,
                    exceededMonthly,
                    source
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