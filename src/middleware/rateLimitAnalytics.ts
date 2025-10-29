import { redisClient } from '../redis/redis';
import { rateLimiterHealth } from './rateLimiterHealth';

export class RateLimitAnalytics {
    // How long to keep raw violation events (ms). Adjust to your needs.
    private retentionMs = 1000 * 60 * 60 * 24 * 30; // 30 days

    /**
     * Log a violation with tier tracking for business analytics.
     * Uses dual storage: global violations + per-user counters for efficient queries.
     * Gracefully handles Redis failures without breaking core functionality.
     * Can add later: 'free' | 'premium' | 'enterprise' = 'free'
     */
    async logViolation(
        userId: string, 
        limitType: string, 
        tier: string = 'unknown'
    ): Promise<void> {
        // Skip if circuit is open (Redis having issues)
        if (rateLimiterHealth.isCircuitOpen()) {
            console.warn('⚠️ Skipping violation logging - circuit open');
            return;
        }

        try {
            const ts = Date.now();
            const violationKey = `rate_limit:violations:${limitType}`;
            const userCounterKey = `rate_limit:user_violations:${userId}`;
            const hourBucket = Math.floor(ts / (60 * 60 * 1000)); // Hourly aggregation
            
            // Make member unique with tier info for business analytics
            const member = `${userId}:${tier}:${ts}:${Math.random().toString(36).slice(2, 9)}`;

            // Atomic multi-command for consistency
            await redisClient
                .multi()
                // Store detailed violation event
                .zadd(violationKey, ts, member)
                // Increment per-user counter (efficient lookups)
                .zincrby(userCounterKey, 1, `${limitType}:${hourBucket}`)
                // Clean up old data
                .zremrangebyscore(violationKey, 0, ts - this.retentionMs)
                // Set expiration
                .expire(violationKey, Math.ceil((this.retentionMs + 1000) / 1000))
                .expire(userCounterKey, Math.ceil((this.retentionMs + 1000) / 1000))
                .exec();

            rateLimiterHealth.recordSuccess();
        } catch (error) {
            // Don't let analytics break core functionality
            console.error('Failed to log rate limit violation:', error, {
                userId,
                limitType,
                tier
            });
        }
    }

    /**
     * Count violations for a specific user in the given hours window.
     * Uses per-user counters for O(1) lookup instead of scanning all violations.
     * Production-safe with error handling and circuit breaker integration.
     */
    async getUserViolationCount(userId: string, hours: number = 24): Promise<number> {
        if (rateLimiterHealth.isCircuitOpen()) {
            console.warn('⚠️ Cannot fetch violation count - circuit open');
            return 0;
        }

        try {
            const userCounterKey = `rate_limit:user_violations:${userId}`;
            const now = Date.now();
            const minHourBucket = Math.floor((now - hours * 60 * 60 * 1000) / (60 * 60 * 1000));
            
            // Get all counters for this user
            const entries = await redisClient.zrange(
                userCounterKey,
                0,
                -1,
                'WITHSCORES'
            ) as string[];
            
            let total = 0;
            // entries is [member, score, member, score, ...]
            for (let i = 0; i < entries.length; i += 2) {
                const member = entries[i];
                const count = parseFloat(entries[i + 1]);
                
                // Parse hour bucket from member (format: "limitType:hourBucket")
                const parts = member.split(':');
                const hourBucket = parseInt(parts[parts.length - 1]);
                
                if (hourBucket >= minHourBucket) {
                    total += count;
                }
            }

            rateLimiterHealth.recordSuccess();
            return total;
        } catch (error) {
            console.error('Failed to get user violation count:', error, { userId, hours });
            return 0;
        }
    }

    /**
     * Return top violators across all limit types in the given hours window.
     * Uses SCAN instead of KEYS for production safety (non-blocking).
     * Returns: [{ userId: 'abc', count: 10, tier: 'free' }, ...]
     */
    async getTopViolators(
        hours: number = 24, 
        limit: number = 10
    ): Promise<Array<{ userId: string; count: number; tier: string }>> {
        if (rateLimiterHealth.isCircuitOpen()) {
            console.warn('⚠️ Cannot fetch top violators - circuit open');
            return [];
        }

        try {
            const max = Date.now();
            const min = max - hours * 60 * 60 * 1000;
            const pattern = `rate_limit:violations:*`;

            // Use SCAN instead of KEYS (production-safe, non-blocking)
            const keys = await this.scanKeys(pattern);

            const userStats: Record<string, { count: number; tier: string }> = {};

            for (const key of keys) {
                // Fetch members in time window
                const members = await redisClient.zrangebyscore(
                    key,
                    min,
                    max
                ) as string[];
                
                for (const m of members) {
                    // Parse member format: `${userId}:${tier}:${ts}:${rand}`
                    const parts = m.split(':');
                    if (parts.length < 2) continue;
                    
                    const [userId, tier] = parts;
                    if (!userId) continue;
                    
                    if (!userStats[userId]) {
                        userStats[userId] = { count: 0, tier: tier || 'unknown' };
                    }
                    userStats[userId].count++;
                }
            }

            const sorted = Object.entries(userStats)
                .map(([userId, stats]) => ({ userId, ...stats }))
                .sort((a, b) => b.count - a.count)
                .slice(0, limit);

            rateLimiterHealth.recordSuccess();
            return sorted;
        } catch (error) {
            console.error('Failed to get top violators:', error, { hours, limit });
            return [];
        }
    }

    /**
     * Production-safe key scanning using SCAN instead of KEYS.
     * Non-blocking and iterates through keys in batches.
     */
    private async scanKeys(pattern: string): Promise<string[]> {
        const keys: string[] = [];
        let cursor = '0';
        
        do {
            const result = await redisClient.scan(
                cursor,
                'MATCH', pattern,
                'COUNT', 100
            ) as [string, string[]];
            
            cursor = result[0];
            keys.push(...result[1]);
        } while (cursor !== '0');
        
        return Array.from(new Set(keys));
    }
}

// Export singleton instance for consistent usage
export const rateLimitAnalytics = new RateLimitAnalytics();
