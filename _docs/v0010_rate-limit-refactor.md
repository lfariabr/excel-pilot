# v0.0.10 Rate Limiter V2 - Improvement Plan

Based on recent works separating Conversations and Messages, here's a strategic improvement roadmap:

## 🎯 Current State Analysis

**What we have:**
- ✅ Redis-based rate limiter with Lua scripts (atomic operations)
- ✅ Separate configs for `openai`, `messages`, `conversations`
- ✅ Token budget tracking (daily: 50K, monthly: 1M)
- ✅ Two distinct models: `Conversation` (thread container) and `Message` (individual turns)
- ✅ Rate limiting on [sendMessage](/excelPilot/src/resolvers/messages/mutations.ts:12:4-132:5) and [startConversation](/excelPilot/src/resolvers/conversations/mutations.ts:12:4-101:5)

**Current gaps:**
```typescript
// rateLimitConfig has 'conversations' defined but...
// checkUserLimit only supports 'openai' | 'messages' types!
```

---

## 🚀 Proposed Improvements (Priority Order)

### **1. Add Conversation-Specific Rate Limiting** ⭐⭐⭐
**Why:** It has been configured, but never implemented it. Prevents spam conversation creation.

```typescript
// In rateLimiter.ts
async checkUserLimit(
  userId: string, 
  limitType: 'openai' | 'messages' | 'conversations'  // ✅ Add this
): Promise<RateLimitResult>
```

**Apply to:**
- [startConversation](/excelPilot/src/resolvers/conversations/mutations.ts:12:4-101:5) mutation (conversation creation protection)
- Any future "list conversations" query (pagination abuse protection)

---

### **2. Separate Rate Limit Concerns** ⭐⭐⭐
**Current issue:** Both mutations check `'openai'` limit, but they serve different purposes.

**Better approach:**
```typescript
// startConversation → check 'conversations' limit
const conversationLimitResult = await userRateLimiter.checkUserLimit(
  ctx.user.sub, 
  'conversations'
);

// sendMessage → check 'messages' limit  
const messageLimitResult = await userRateLimiter.checkUserLimit(
  ctx.user.sub, 
  'messages'
);

// Both still check token budget (cost protection)
```

**Benefits:**
- More granular control (user can create fewer conversations but send more messages)
- Better DDoS protection (can't spam conversation creation)
- Clearer separation of concerns

---

### **3. Add Tiered/Role-Based Rate Limiting** ⭐⭐
**Why:** So we align feature with monetization strategy

```typescript
// rateLimit.config.ts
export const rateLimitTiers = {
  free: {
    conversations: { windowMs: 60_000, max: 3 },
    messages: { windowMs: 60_000, max: 20 },
    openai: { windowMs: 60_000, max: 10 },
    tokenBudget: { daily: 25_000, monthly: 500_000 }
  },
  premium: {
    conversations: { windowMs: 60_000, max: 10 },
    messages: { windowMs: 60_000, max: 50 },
    openai: { windowMs: 60_000, max: 30 },
    tokenBudget: { daily: 100_000, monthly: 2_000_000 }
  },
  enterprise: {
    conversations: { windowMs: 60_000, max: 50 },
    messages: { windowMs: 60_000, max: 200 },
    openai: { windowMs: 60_000, max: 100 },
    tokenBudget: { daily: 500_000, monthly: 10_000_000 }
  }
};
```

**Implementation:**
```typescript
async checkUserLimit(
  userId: string, 
  limitType: 'openai' | 'messages' | 'conversations',
  userTier: 'free' | 'premium' | 'enterprise' = 'free'
): Promise<RateLimitResult> {
  const config = rateLimitTiers[userTier][limitType];
  // ... rest of logic
}
```

---

### **4. Add Rate Limit Analytics** ⭐⭐
**Track violations for business insights:**

```typescript
// New utility: rateLimitAnalytics.ts
export class RateLimitAnalytics {
  async logViolation(userId: string, limitType: string, tier: string) {
    // Store in Redis sorted set for time-series analysis
    await redisClient.zadd(
      `rate_limit:violations:${limitType}`, 
      Date.now(), 
      `${userId}:${tier}`
    );
  }
  
  async getUserViolationCount(userId: string, hours: number = 24) {
    // Check if user is abusing limits (upgrade opportunity!)
  }
  
  async getTopViolators(limit: number = 10) {
    // Identify users hitting limits frequently
    // → Upsell candidates or abuse detection
  }
}
```

---

### **5. Improve Error Messages with Actionable Guidance** ⭐
**Current:**
```typescript
throw new GraphQLError(`Rate limit exceeded. Try again in ${seconds} seconds.`);
```

**Better:**
```typescript
throw new GraphQLError(
  `You've reached your ${tier} plan limit (${max} ${limitType}/minute). ` +
  `Upgrade to Premium for ${premiumMax}x more capacity or wait ${seconds}s.`,
  {
    extensions: {
      code: "RATE_LIMIT_EXCEEDED",
      currentTier: tier,
      upgradeAvailable: true,
      upgradePath: "/pricing",
      resetTime: rateLimitResult.resetTime
    }
  }
);
```

---

### **6. Add Redis Health Check & Circuit Breaker** ⭐⭐
**Problem:** Current "fail-open" strategy is good but lacks visibility.

```typescript
// rateLimiterHealth.ts
export class RateLimiterHealth {
  private failures = 0;
  private readonly threshold = 5;
  private circuitOpen = false;
  
  async checkHealth() {
    try {
      await redisClient.ping();
      this.failures = 0;
      this.circuitOpen = false;
    } catch (error) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.circuitOpen = true;
        // Alert ops team
        console.error('⚠️ RATE LIMITER CIRCUIT OPEN - Redis unavailable');
      }
    }
  }
  
  isHealthy(): boolean {
    return !this.circuitOpen;
  }
}
```

---

### **7. Add Rate Limit Bypass for Admin/Testing** ⭐
```typescript
// In middleware
if (ctx.user.role === 'admin' || process.env.BYPASS_RATE_LIMITS === 'true') {
  return { allowed: true, remaining: Infinity, resetTime: 0 };
}
```

---

## 📋 Implementation Checklist

```typescript
// v0.0.10 Deliverables
✅ Split Conversations/Messages (DONE by you!)
✅ Add 'conversations' to checkUserLimit type union
✅ Apply conversation rate limit to startConversation
✅ Apply message rate limit to sendMessage  
⏳ Create tiered rate limit configuration
⏳ Add userTier parameter to rate limiter methods
⏳ Implement RateLimitAnalytics class
✅ Add circuit breaker for Redis failures
✅ Improve error messages with upgrade CTAs
⏳ Add admin bypass capability
✅ Update tests for new conversation limits
✅ Update tests for tiered limits

```

---

## 🎯 Quick Win Implementation Order

1. **Phase 1 (30 min):** Add `'conversations'` type support + apply to [startConversation](/excelPilot/src/resolvers/conversations/mutations.ts:12:4-101:5)
2. **Phase 2 (45 min):** Separate `'messages'` vs `'openai'` limits in mutations
3. **Phase 3 (1-2 hrs):** Implement tiered rate limiting with User model integration
4. **Phase 4 (1 hr):** Add analytics and monitoring
5. **Phase 5 (30 min):** Circuit breaker + health checks

---

## 🤔 Questions to Consider:

1. **Do we want tiered limits now or in a future version?** (Affects User model - need to add `tier` or `plan` field)
2. **Should we track rate limit violations for analytics?** (Business intelligence opportunity)
3. **Do we want different limits for conversation creation vs message sending?** (Recommended: yes)

---

# TTL Mechanism Explained

## 🔍 How It Works (Sliding Fixed Window)

The current implementation uses a **fixed window** approach with automatic TTL management. Here's the breakdown:

### **checkUserLimit.lua (Rate Limiting)**

```lua
-- Step 1: Increment counter atomically
local count = redis.call('INCR', KEYS[1])  -- e.g., "rateLimit:userId:openai"

-- Step 2: Set TTL only on FIRST request (count == 1)
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])  -- e.g., 60 seconds
end

-- Step 3: TTL repair (if orphaned)
local ttl = redis.call('TTL', KEYS[1])
if ttl == -1 then  -- -1 means key exists but no TTL set
    redis.call('EXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
```

### **Key Characteristics:**

#### ✅ **Fixed Window Pattern**
- **First request starts the window** → Counter = 1, TTL = 60s
- **Subsequent requests increment** → Counter = 2, 3, 4... (TTL keeps ticking down)
- **After 60s, key expires** → Counter resets to 0 automatically

**Example timeline:**
```
00:00 → Request 1 → Counter: 1, TTL: 60s
00:10 → Request 2 → Counter: 2, TTL: 50s
00:30 → Request 3 → Counter: 3, TTL: 30s
01:00 → Key expires → Counter: 0 (Redis auto-deletes)
01:05 → Request 4 → Counter: 1, TTL: 60s (new window)
```

---

## 🎯 No Risk of Ballooning - Here's Why:

### **1. Automatic Expiration (Redis EXPIRE)**
```lua
redis.call('EXPIRE', KEYS[1], 60)  -- Key WILL be deleted after 60s!
```
- Redis guarantees expiration
- No manual cleanup needed
- Keys are **self-destructing**

### **2. TTL Repair Logic (Orphan Protection)**
```lua
if ttl == -1 then  -- Key exists but no expiration set
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
```
**Why this matters:**
- Protects against Redis crashes between `INCR` and `EXPIRE`
- Prevents "zombie keys" that live forever
- Ensures **every key eventually expires**

### **3. Scoped Key Structure**
```typescript
const key = `rateLimit:${userId}:${limitType}`;
// Examples:
// "rateLimit:user123:openai"
// "rateLimit:user456:messages"
// "token_budget:daily:user789"
```
- One key per user per limit type
- **Not accumulating** (counter is overwritten in same key)
- Maximum keys = `users × limitTypes` (e.g., 1000 users × 3 types = 3000 keys max)

---

## ⚠️ Potential Issues (Edge Cases)

### **1. Window Boundary Problem**
```
User can "game" the system at window boundaries:

59:50 → Send 10 requests (limit: 10) ✅
00:01 → Window resets, send 10 more ✅
Total: 20 requests in 11 seconds!
```

**Impact:** Burst spikes at minute boundaries

**Solutions:**
- **Sliding window** (more complex, higher Redis load)
- **Token bucket** (smoother distribution)
- **Accept it** (fixed window is industry standard, Redis/Nginx use it)

### **2. Redis Persistence Risk**
If Redis crashes **before persisting** the key:
```lua
INCR key → count = 5 (in memory)
[Redis crashes before AOF/RDB write]
[Redis restarts]
GET key → returns nil (data lost)
```

**Mitigation:**
- The Lua script handles this via TTL repair
- Use Redis persistence (AOF or RDB snapshots)
- Risk is **minimal** for rate limiting (not financial data)

### **3. Clock Skew in Distributed Redis**
If using Redis Cluster with multiple nodes:
- TTL might vary slightly between nodes
- Generally not an issue for rate limiting

---

## 📊 Memory Footprint Analysis

Let's calculate max memory usage:

```typescript
// Assumptions:
// - 1000 active users
// - 3 limit types (openai, messages, conversations)
// - 2 token budgets (daily, monthly)

Key structure per user:
- rateLimit:userId:openai → ~50 bytes
- rateLimit:userId:messages → ~50 bytes
- rateLimit:userId:conversations → ~50 bytes
- token_budget:daily:userId → ~50 bytes
- token_budget:monthly:userId → ~50 bytes

Total per user: 250 bytes
Total for 1000 users: 250KB
Total for 1M users: 250MB
```

**Verdict:** Extremely memory-efficient. **No ballooning risk.**

---

## 🔄 Comparison: Current vs Alternatives

### **My Current: Fixed Window**
```
✅ Simple & predictable
✅ Low Redis CPU usage (1 INCR per request)
✅ No memory accumulation
⚠️ Burst spikes at boundaries
```

### **Sliding Window**
```
✅ Smoother rate limiting
✅ No boundary gaming
❌ Higher complexity (multiple keys per window)
❌ More Redis operations (3-5 per request)
```

### **Token Bucket**
```
✅ Burst allowance (better UX)
✅ Flexible refill rates
❌ More complex logic
❌ Needs background refill process
```

---

## ✅ Conclusion

**Current implementation is solid:**
1. ✅ **No ballooning risk** → Keys auto-expire via Redis EXPIRE
2. ✅ **Orphan protection** → TTL repair logic prevents zombie keys
3. ✅ **Memory efficient** → Fixed small footprint per user
4. ✅ **Atomic operations** → Lua scripts prevent race conditions
5. ⚠️ **Known limitation** → Fixed window allows boundary bursts (assuming it's an acceptable trade-off)

**My Take:** Keep the current approach. It's production-ready and follows industry best practices (same pattern used by GitHub, Stripe, AWS APIs).

---