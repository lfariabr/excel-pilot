# Rate Limiting Implementation Strategy - Learning Guide

## 🎯 **The Problem We're Solving**

The [sendMessage](cci:1://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:30:4-82:5) mutation calls OpenAI API. Without rate limiting:
- A user could spam 1000 requests in 1 minute
- Each request costs you money (tokens)
- Your API could crash from overload
- **Result: Bankruptcy and downtime** 💸

## 🏗️ **Architecture Overview**

```
User Request → Rate Limiter → Your GraphQL → OpenAI API
                    ↓
                Redis Store
```

**Why Redis?** Because it's fast, shared across server instances, and perfect for counters with expiration.

## 📁 **Files You'll Create (Step by Step)**

### **Step 1: Redis Connection** 

- **File:** [src/config/redis.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/config/redis.ts:0:0-0:0)
- **Purpose:** Connect to Redis database
- **What you'll learn:** How to configure Redis client, handle connection events

### **Step 2: Rate Limiting Logic**

- **File:** [src/middleware/rateLimiter.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/middleware/rateLimiter.ts:0:0-0:0) 
- **Purpose:** Core rate limiting logic
- **What you'll learn:** How to track user requests, implement sliding windows, token budgets

### **Step 3: Integration**

- **File:** Update [src/resolvers/conversations/mutations.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:0:0-0:0)
- **Purpose:** Apply rate limiting to sendMessage
- **What you'll learn:** How to integrate middleware into GraphQL resolvers

### **Step 4: Environment Config**

- **File:** Update [.env](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/.env:0:0-0:0)
- **Purpose:** Redis connection settings
- **What you'll learn:** Environment-based configuration

## 🧠 **Key Concepts You'll Master**

### **1. Rate Limiting Patterns**
- **Request-based**: "10 requests per minute"
- **Token-based**: "50,000 tokens per day" 
- **Sliding window**: More sophisticated than fixed windows

### **2. Redis Key Strategies**
```
rate_limit:openai:user123     → Request counter
token_budget:daily:user123    → Daily token usage
```

### **3. Graceful Failure**
What happens when Redis is down? (Hint: Fail open vs fail closed)

## 🎯 **Implementation Strategy**

### **Phase 1: Basic Setup**
1. Create Redis connection
2. Test connection works
3. Add to your app startup

### **Phase 2: Simple Rate Limiting**
1. Create a function that tracks "requests per user per minute"
2. Use Redis INCR and EXPIRE commands
3. Test with console.log

### **Phase 3: GraphQL Integration**
1. Add rate limiting check to sendMessage mutation
2. Throw GraphQL error when limit exceeded
3. Test with multiple rapid requests

### **Phase 4: Token Budget**
1. Estimate token usage before OpenAI call
2. Track actual token usage after OpenAI response
3. Implement daily/monthly budgets

## 🔧 **What You'll Learn**

- **Redis operations**: INCR, EXPIRE, GET, TTL
- **Error handling**: What to do when rate limit hit
- **User experience**: Meaningful error messages
- **Performance**: Why Redis is better than database counters
- **Security**: Preventing abuse and cost explosion

# Phase 1: Redis Connection Setup

Perfect! Let's build your Redis connection step by step. I'll explain the **why** behind every decision.

## 🎯 **What We're Building**

A Redis client that:
- Connects to your local Redis server
- Handles connection events (success/failure)
- Provides a reusable client for rate limiting
- Fails gracefully when Redis is down

## 📁 **Step 1: Create the Redis Config File**

**File:** [src/config/redis.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/config/redis.ts:0:0-0:0)

```typescript
import Redis from 'ioredis';

// Redis configuration object
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  // Only add password if it exists in env
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  
  // Connection settings
  retryDelayOnFailover: 100,  // Retry quickly if Redis fails
  enableReadyCheck: false,    // Don't wait for Redis to be "ready"
  maxRetriesPerRequest: null, // Keep trying forever
  lazyConnect: true,          // Don't connect immediately
};

// Create the Redis client
export const redisClient = new Redis(redisConfig);

// Connection event handlers (for debugging)
redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err.message);
});

redisClient.on('close', () => {
  console.log('🔌 Redis client connection closed');
});

// Graceful shutdown
process.on('SIGINT', () => {
  redisClient.disconnect();
});

process.on('SIGTERM', () => {
  redisClient.disconnect();
});

export default redisClient;
```

## 🧠 **Key Learning Points**

### **1. Why `lazyConnect: true`?**
- Doesn't connect until first Redis command
- Prevents startup crashes if Redis is down
- Your app can start even without Redis

### **2. Why event handlers?**
- **Debugging**: See what's happening with Redis
- **Monitoring**: Know when Redis goes down
- **Development**: Immediate feedback

### **3. Why graceful shutdown?**
- Closes Redis connection when app shuts down
- Prevents hanging connections
- Good practice for production

## 📁 **Step 2: Environment Variables**

**File:** [.env](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/.env:0:0-0:0) (add these lines)

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_password_if_needed
```

## 🧠 **Why Environment Variables?**

- **Development**: localhost:6379
- **Production**: Could be Redis Cloud, AWS ElastiCache, etc.
- **Security**: Passwords not in code
- **Flexibility**: Easy to change without code changes

## 📁 **Step 3: Test the Connection**

**File:** `src/test-redis.ts` (temporary file for testing)

```typescript
import { redisClient } from './config/redis';

async function testRedis() {
  try {
    console.log('Testing Redis connection...');
    
    // Simple test: set and get a value
    await redisClient.set('test:connection', 'working');
    const result = await redisClient.get('test:connection');
    
    console.log('✅ Redis test result:', result);
    
    // Clean up
    await redisClient.del('test:connection');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Redis test failed:', error);
    process.exit(1);
  }
}

testRedis();
```

## 🚀 **How to Test**

1. **Start Redis** (if not running):
   ```bash
   redis-server
   ```

2. **Run the test**:
   ```bash
   npx ts-node src/test-redis.ts
   ```

3. **Expected output**:
   ```
   ✅ Redis client connected
   ✅ Redis client ready
   Testing Redis connection...
   ✅ Redis test result: working
   ```

## 🎯 **What You're Learning**

- **Redis basics**: SET, GET, DEL commands
- **Async/await**: Redis operations are promises
- **Error handling**: Try/catch for Redis failures
- **Connection lifecycle**: Connect → Ready → Commands

## 🔧 **Common Issues & Solutions**

### **Issue**: "Connection refused"
**Solution**: Start Redis with `redis-server`

### **Issue**: "NOAUTH Authentication required"
**Solution**: Add `REDIS_PASSWORD` to [.env](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/.env:0:0-0:0) or disable auth

### **Issue**: "Module not found"
**Solution**: Make sure you installed `ioredis`

## ✅ **Phase 1 Complete When:**

- [X] Redis config file created
- [X] Environment variables added
- [X] Test file runs successfully
- [X] You understand why each piece exists

# Phase 2: Simple Rate Limiting Logic

Now let's build the **core rate limiting functionality**. This is where the magic happens!

## 🎯 **What We're Building**

A rate limiter that can:
- Track "requests per user per time window"
- Use Redis counters with automatic expiration
- Return meaningful information (allowed/denied, remaining requests, reset time)

## 🧠 **Key Concepts You'll Learn**

### **1. Redis Commands for Rate Limiting**
- `INCR key` - Increment a counter (creates if doesn't exist)
- `EXPIRE key seconds` - Set expiration time
- `TTL key` - Get remaining time until expiration
- `GET key` - Get current value

### **2. Rate Limiting Algorithm**
```
1. Check current count for user
2. If count >= limit → DENY
3. If count < limit → INCREMENT and ALLOW
4. Set expiration on first request
```

### **3. Redis Key Strategy**
```
rate_limit:openai:user123    → Counter for OpenAI requests
rate_limit:messages:user456  → Counter for general messages
```

## 📁 **Step 1: Create Rate Limiter Class**

**File:** [src/middleware/rateLimiter.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/middleware/rateLimiter.ts:0:0-0:0)

```typescript
import { redisClient } from '../redis';

// Rate limiting configuration
export const rateLimitConfig = {
  openai: {
    windowMs: 60 * 1000,  // 1 minute window
    max: 10,              // 10 requests per window
  },
  messages: {
    windowMs: 60 * 1000,  // 1 minute window  
    max: 30,              // 30 requests per window
  }
};

// Rate limit result interface
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export class UserRateLimiter {
  
  /**
   * Check if user can make a request
   * @param userId - User ID from JWT token
   * @param limitType - Type of limit ('openai' or 'messages')
   */
  async checkUserLimit(userId: string, limitType: 'openai' | 'messages'): Promise<RateLimitResult> {
    const key = `rate_limit:${limitType}:${userId}`;
    const config = rateLimitConfig[limitType];
    
    try {
      // Get current count
      const current = await redisClient.get(key);
      const count = current ? parseInt(current) : 0;
      
      // Check if limit exceeded
      if (count >= config.max) {
        const ttl = await redisClient.ttl(key);
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + (ttl * 1000)
        };
      }
      
      // Increment counter
      const newCount = await redisClient.incr(key);
      
      // Set expiration on first request
      if (newCount === 1) {
        await redisClient.expire(key, Math.floor(config.windowMs / 1000));
      }
      
      return {
        allowed: true,
        remaining: config.max - newCount,
        resetTime: Date.now() + config.windowMs
      };
      
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: config.max,
        resetTime: Date.now() + config.windowMs
      };
    }
  }
}

// Export singleton instance
export const userRateLimiter = new UserRateLimiter();
```

## 🧠 **Key Learning Points**

### **1. Why `incr` instead of `set`?**
- `INCR` is atomic - no race conditions
- Creates key if doesn't exist
- Returns new value in one operation

### **2. Why check TTL?**
- Tells us when the window resets
- Provides accurate "try again in X seconds" info
- Essential for user experience

### **3. Why "fail open"?**
- If Redis is down, don't break your app
- Better to allow requests than block everything
- You can change this to "fail closed" if security is critical

### **4. Why separate `limitType`?**
- OpenAI calls are expensive → strict limits
- General messages are cheap → looser limits
- Different business rules for different operations

## 📁 **Step 2: Test the Rate Limiter**

**File:** `src/test-rate-limiter.ts`

```typescript
import { userRateLimiter } from './middleware/rateLimiter';

async function testRateLimiter() {
  const userId = 'test-user-123';
  
  console.log('🧪 Testing rate limiter...\n');
  
  // Test OpenAI rate limiting
  console.log('--- OpenAI Rate Limiting (10 per minute) ---');
  
  for (let i = 1; i <= 12; i++) {
    const result = await userRateLimiter.checkUserLimit(userId, 'openai');
    
    console.log(`Request ${i}:`, {
      allowed: result.allowed,
      remaining: result.remaining,
      resetIn: Math.ceil((result.resetTime - Date.now()) / 1000) + 's'
    });
    
    // Small delay to see the progression
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n--- Waiting for reset (or test with different user) ---');
  
  // Test with different user (should be allowed)
  const result = await userRateLimiter.checkUserLimit('different-user', 'openai');
  console.log('Different user:', {
    allowed: result.allowed,
    remaining: result.remaining
  });
  
  process.exit(0);
}

testRateLimiter().catch(console.error);
```

## 🚀 **How to Test**

1. **Run the test**:
   ```bash
   npx ts-node src/test-rate-limiter.ts
   ```

2. **Expected output**:
   ```
   🧪 Testing rate limiter...
   
   --- OpenAI Rate Limiting (10 per minute) ---
   Request 1: { allowed: true, remaining: 9, resetIn: 60s }
   Request 2: { allowed: true, remaining: 8, resetIn: 60s }
   ...
   Request 10: { allowed: true, remaining: 0, resetIn: 60s }
   Request 11: { allowed: false, remaining: 0, resetIn: 59s }
   Request 12: { allowed: false, remaining: 0, resetIn: 59s }
   
   --- Waiting for reset (or test with different user) ---
   Different user: { allowed: true, remaining: 9 }
   ```

## 🎯 **What You're Learning**

- **Sliding windows**: Each user has their own timer
- **Per-user isolation**: One user can't affect another
- **Graceful degradation**: Works even if Redis has issues
- **Business logic**: Different limits for different operations
- **User experience**: Meaningful error messages with reset times

## ✅ **Phase 2 Complete When:**

- [X] Rate limiter class created
- [X] Test file shows proper limiting behavior
- [X] You understand the Redis key strategy
- [X] You can explain why we use INCR + EXPIRE

# Phase 3: Integrate Rate Limiting into sendMessage

This is where we protect your OpenAI API calls from abuse and cost explosion!

## 🎯 **What We're Building**

We'll add rate limiting **before** the OpenAI call in your [sendMessage](cci:1://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:30:4-82:5) mutation:

```
User Request → Authentication → Rate Limiting → OpenAI API
                                      ↓
                               GraphQL Error if exceeded
```

## 🧠 **Strategy Overview**

1. **Import** the rate limiter into your mutations
2. **Check** rate limit after authentication but before OpenAI call
3. **Throw** meaningful GraphQL error if limit exceeded
4. **Continue** normally if allowed

## 📁 **Step 1: Update sendMessage Mutation**

**File:** [src/resolvers/conversations/mutations.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:0:0-0:0)

Add the import at the top:
```typescript
import { userRateLimiter } from '../../middleware/rateLimiter';
```

Then modify your [sendMessage](cci:1://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:30:4-82:5) function. Here's the **exact spot** to add rate limiting:

```typescript
sendMessage: async (_: any, { conversationId, content }: { conversationId: string, content: string }, ctx: any) => {
    requireAuth(ctx);
    if (!ctx.user) {
        throw new GraphQLError("UNAUTHENTICATED");
    }
    
    // 🚨 ADD RATE LIMITING HERE - BEFORE OpenAI call
    const rateLimitResult = await userRateLimiter.checkUserLimit(ctx.user.sub, 'openai');
    
    if (!rateLimitResult.allowed) {
        throw new GraphQLError(
            `Rate limit exceeded. You can make ${rateLimitConfig.openai.max} OpenAI requests per minute. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`,
            {
                extensions: {
                    code: 'RATE_LIMITED',
                    remaining: rateLimitResult.remaining,
                    resetTime: rateLimitResult.resetTime
                }
            }
        );
    }
    
    console.log("conversationId", conversationId);
    const conversation = await Conversation.findById(conversationId);
    // ... rest of your existing code stays the same
```

You'll also need to import the config:
```typescript
import { userRateLimiter, rateLimitConfig } from '../../middleware/rateLimiter';
```

## 🧠 **Key Learning Points**

### **1. Why check AFTER authentication?**
- Unauthenticated users can't spam your API
- Rate limiting is per-user, so we need `ctx.user.sub`
- Security first, then rate limiting

### **2. Why BEFORE OpenAI call?**
- Don't waste money on blocked requests
- Fail fast - better user experience
- Protect your most expensive operation

### **3. Why meaningful error messages?**
- Tell user exactly what happened
- Tell them when they can try again
- Include remaining quota for better UX

### **4. Why GraphQL extensions?**
- Structured error data for frontend
- Can be used for retry logic
- Better than just error strings

## 📁 **Step 2: Test Rate Limiting in GraphQL**

**File:** `src/test-graphql-rate-limit.ts`

```typescript
import { userRateLimiter } from './middleware/rateLimiter';

async function testGraphQLRateLimit() {
    const userId = 'test-user-graphql';
    
    console.log('🧪 Testing GraphQL rate limiting simulation...\n');
    
    // Simulate what happens in sendMessage mutation
    for (let i = 1; i <= 12; i++) {
        console.log(`--- Simulated sendMessage Request ${i} ---`);
        
        // This is what your mutation will do
        const rateLimitResult = await userRateLimiter.checkUserLimit(userId, 'openai');
        
        if (!rateLimitResult.allowed) {
            console.log('❌ BLOCKED - GraphQL Error would be thrown:');
            console.log(`   Message: Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`);
            console.log(`   Code: RATE_LIMITED`);
            console.log(`   Remaining: ${rateLimitResult.remaining}`);
        } else {
            console.log('✅ ALLOWED - Would proceed to OpenAI call');
            console.log(`   Remaining requests: ${rateLimitResult.remaining}`);
            console.log('   🤖 [Simulated OpenAI call would happen here]');
        }
        
        console.log('');
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    process.exit(0);
}

testGraphQLRateLimit().catch(console.error);
```

## 🚀 **How to Test the Integration**

### **Option 1: Unit Test (Recommended first)**
```bash
npx ts-node src/test-graphql-rate-limit.ts
```

### **Option 2: Real GraphQL Test**
1. Start your server: `npm run dev`
2. Go to Apollo Studio: `http://localhost:4000/graphql`
3. Run this mutation 12 times quickly:
```graphql
mutation {
  sendMessage(conversationId: "your-conversation-id", content: "test message") {
    id
    content
  }
}
```

## 🎯 **Expected Behavior**

- **Requests 1-10**: Normal OpenAI responses
- **Requests 11+**: GraphQL error with rate limit message
- **After 1 minute**: Rate limit resets, requests work again

## ✅ **Phase 3 Complete When:**

- [X] Rate limiting added to sendMessage mutation
- [X] GraphQL errors thrown when limit exceeded
- [X] Test shows proper blocking behavior
- [X] You understand the request flow

**Ready to add this protection to your mutation?**

This is the **critical piece** that prevents your OpenAI costs from exploding! 🛡️💰

# Phase 4: Token Budget Tracking

Now let's add the **advanced protection** - tracking actual token usage to prevent cost explosion even further!

## 🎯 **What We're Building**

A **token budget system** that:
- Tracks daily/monthly token consumption per user
- Estimates tokens before OpenAI call
- Updates with actual usage after OpenAI response
- Blocks users who exceed their budget

## 🧠 **The Problem**

Rate limiting by requests isn't enough:
- Short message = ~50 tokens = $0.001
- Long conversation = ~2000 tokens = $0.04
- **Same request count, 40x cost difference!**

## 📁 **Step 1: Add Token Budget to Rate Limiter**

**File:** [src/middleware/rateLimiter.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/middleware/rateLimiter.ts:0:0-0:0) (add this method to your UserRateLimiter class)

```typescript
/**
 * Check and update token budget for user
 * @param userId - User ID from JWT token
 * @param tokensToUse - Estimated or actual tokens to consume
 */
async checkTokenBudget(userId: string, tokensToUse: number): Promise<RateLimitResult> {
  const dailyKey = `token_budget:daily:${userId}`;
  const monthlyKey = `token_budget:monthly:${userId}`;
  
  // Budget limits (adjust based on your business model)
  const dailyLimit = 50000;   // 50K tokens per day (~$1.00)
  const monthlyLimit = 1000000; // 1M tokens per month (~$20.00)
  
  try {
    // Get current usage
    const [dailyUsed, monthlyUsed] = await Promise.all([
      redisClient.get(dailyKey).then(val => parseInt(val || '0')),
      redisClient.get(monthlyKey).then(val => parseInt(val || '0'))
    ]);
    
    // Check if adding tokens would exceed limits
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
    
    // Update token usage
    const pipeline = redisClient.pipeline();
    pipeline.incrby(dailyKey, tokensToUse);
    pipeline.expire(dailyKey, 24 * 60 * 60); // 24 hours
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
    };
    
  } catch (error) {
    console.error('Token budget error:', error);
    // Fail open
    return {
      allowed: true,
      remaining: dailyLimit,
      resetTime: Date.now() + (24 * 60 * 60 * 1000)
    };
  }
}
```

## 📁 **Step 2: Token Estimation Helper**

**File:** `src/utils/tokenEstimator.ts`

```typescript
/**
 * Rough token estimation for OpenAI requests
 * More accurate than character counting
 */
export class TokenEstimator {
  
  /**
   * Estimate tokens for a conversation
   * Rule of thumb: ~4 characters per token for English
   * Add overhead for system prompts and formatting
   */
  static estimateTokens(userMessage: string, history: any[]): number {
    // User message tokens
    const userTokens = Math.ceil(userMessage.length / 4);
    
    // History tokens (last 10 messages)
    const historyTokens = history.reduce((total, msg) => {
      return total + Math.ceil(msg.content.length / 4);
    }, 0);
    
    // System prompt overhead (~200 tokens)
    const systemOverhead = 200;
    
    // Response estimation (assume similar length to input)
    const responseEstimate = Math.max(100, userTokens);
    
    return userTokens + historyTokens + systemOverhead + responseEstimate;
  }
  
  /**
   * Get actual tokens from OpenAI response
   */
  static getActualTokens(openaiResponse: any): number {
    return openaiResponse.usage?.total_tokens || 0;
  }
}
```

## 📁 **Step 3: Update sendMessage with Token Budget**

**File:** [src/resolvers/conversations/mutations.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:0:0-0:0)

Add imports:
```typescript
import { TokenEstimator } from '../../utils/tokenEstimator';
```

Update your sendMessage mutation (add this after rate limiting but before OpenAI call):

```typescript
// Existing rate limiting code...

// Estimate token usage BEFORE OpenAI call
const estimatedTokens = TokenEstimator.estimateTokens(content, history);

// Check token budget
const budgetResult = await userRateLimiter.checkTokenBudget(ctx.user.sub, estimatedTokens);

if (!budgetResult.allowed) {
    throw new GraphQLError(
        `Daily token budget exceeded. Remaining: ${budgetResult.remaining} tokens. Resets in ${Math.ceil((budgetResult.resetTime - Date.now()) / (1000 * 60 * 60))} hours.`,
        {
            extensions: {
                code: 'TOKEN_BUDGET_EXCEEDED',
                remaining: budgetResult.remaining,
                resetTime: budgetResult.resetTime
            }
        }
    );
}

// call openAI (your existing code)
const talkToOpenAI = await askOpenAI({
    history,
    userMessage: content,
});

// Update with ACTUAL token usage after OpenAI response
const actualTokens = TokenEstimator.getActualTokens(talkToOpenAI);
const tokenDifference = actualTokens - estimatedTokens;

if (tokenDifference > 0) {
    // We underestimated, add the difference
    await userRateLimiter.checkTokenBudget(ctx.user.sub, tokenDifference);
}

// Rest of your existing code...
```

## 🧠 **Key Learning Points**

### **1. Why estimate AND track actual?**
- **Estimate**: Prevent budget exceeded before expensive call
- **Actual**: Accurate tracking for billing/analytics
- **Difference**: Improve estimation algorithm over time

### **2. Why daily AND monthly budgets?**
- **Daily**: Prevent single-day abuse
- **Monthly**: Business model alignment
- **Dual protection**: More sophisticated than single limit

### **3. Why pipeline for Redis updates?**
- **Atomic**: All operations succeed or fail together
- **Performance**: Single round trip to Redis
- **Consistency**: No partial updates

## 📁 **Step 4: Test Token Budget**

**File:** `src/test-token-budget.ts`

```typescript
import { userRateLimiter } from './middleware/rateLimiter';
import { TokenEstimator } from './utils/tokenEstimator';

async function testTokenBudget() {
    const userId = 'test-token-user';
    
    console.log('🧪 Testing token budget system...\n');
    
    // Simulate different message sizes
    const testMessages = [
        { content: 'Hi', expectedTokens: ~50 },
        { content: 'Write a long essay about AI and its implications for society, covering multiple aspects and providing detailed analysis.', expectedTokens: ~500 },
        { content: 'x'.repeat(1000), expectedTokens: ~250 } // Very long message
    ];
    
    for (const msg of testMessages) {
        console.log(`--- Testing message: "${msg.content.substring(0, 50)}..." ---`);
        
        const estimated = TokenEstimator.estimateTokens(msg.content, []);
        console.log(`Estimated tokens: ${estimated}`);
        
        const budgetResult = await userRateLimiter.checkTokenBudget(userId, estimated);
        console.log(`Budget check:`, {
            allowed: budgetResult.allowed,
            remaining: budgetResult.remaining,
            resetIn: Math.ceil((budgetResult.resetTime - Date.now()) / (1000 * 60 * 60)) + 'h'
        });
        
        console.log('');
    }
    
    // Test budget exhaustion
    console.log('--- Testing budget exhaustion ---');
    const hugeBudget = 60000; // More than daily limit
    const exhaustResult = await userRateLimiter.checkTokenBudget(userId, hugeBudget);
    console.log('Huge request result:', exhaustResult);
    
    process.exit(0);
}

testTokenBudget().catch(console.error);
```

## ✅ **Phase 4 Complete When:**

- [X] Token budget method added to rate limiter
- [X] Token estimator utility created
- [X] sendMessage updated with token tracking
- [X] Test shows budget enforcement working
