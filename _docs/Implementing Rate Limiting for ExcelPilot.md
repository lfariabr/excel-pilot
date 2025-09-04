# Rate Limiting Implementation Strategy - Learning Guide

Perfect! You have the dependencies installed. Now let me teach you the **strategy** and **architecture** so you understand exactly what you're building and why.

## 🎯 **The Problem We're Solving**

Your [sendMessage](cci:1://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:30:4-82:5) mutation calls OpenAI API. Without rate limiting:
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
**File:** [src/config/redis.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/config/redis.ts:0:0-0:0)
**Purpose:** Connect to Redis database
**What you'll learn:** How to configure Redis client, handle connection events

### **Step 2: Rate Limiting Logic**
**File:** [src/middleware/rateLimiter.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/middleware/rateLimiter.ts:0:0-0:0) 
**Purpose:** Core rate limiting logic
**What you'll learn:** How to track user requests, implement sliding windows, token budgets

### **Step 3: Integration**
**File:** Update [src/resolvers/conversations/mutations.ts](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:0:0-0:0)
**Purpose:** Apply rate limiting to sendMessage
**What you'll learn:** How to integrate middleware into GraphQL resolvers

### **Step 4: Environment Config**
**File:** Update [.env](cci:7://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/.env:0:0-0:0)
**Purpose:** Redis connection settings
**What you'll learn:** Environment-based configuration

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

## 🚀 **Ready to Start?**

Tell me when you want to begin with **Step 1: Redis Connection**. I'll guide you through creating the file, explain every line, and show you how to test it.

The goal is that by the end, you'll understand:
- Why each piece exists
- How to modify limits
- How to debug rate limiting issues
- How to extend it for other use cases

**Which step do you want to tackle first?**

*Viewed [mutations.ts](file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts) *

### User Input

beautiful
ready for phase 1

*Updated todo list*

### Planner Response

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

- [ ] Redis config file created
- [ ] Environment variables added
- [ ] Test file runs successfully
- [ ] You understand why each piece exists

**Ready to create these files? Or do you have questions about the strategy first?**

Once Phase 1 works, we'll move to Phase 2: **Simple Rate Limiting Logic** where you'll learn how to count requests per user!

*Edited relevant file*

*Edited relevant file*

*Edited relevant file*

*User accepted the command `redis-server`*

*Viewed [redis.ts](file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/redis.ts) *

*User accepted the command `redis-cli ping`*

### User Input

           _.-``__ ''-._                                             
      _.-``    `.  `_.  ''-._           Redis Open Source            
  .-`` .-```.  ```\/    _.,_ ''-._      8.0.0 (00000000/1) 64 bit
 (    '      ,       .-`  | `,    )     Running in standalone mode
 |`-._`-...-` __...-.``-._|'` _.-'|     Port: 6379
 |    `-._   `._    /     _.-'    |     PID: 6170
  `-._    `-._  `-./  _.-'    _.-'                                   
 |`-._`-._    `-.__.-'    _.-'_.-'|                                  
 |    `-._`-._        _.-'_.-'    |           https://redis.io       
  `-._    `-._`-.__.-'_.-'    _.-'                                   
 |`-._`-._    `-.__.-'    _.-'_.-'|                                  
 |    `-._`-._        _.-'_.-'    |                                  
  `-._    `-._`-.__.-'_.-'    _.-'                                   
      `-._    `-.__.-'    _.-'                                       
          `-._        _.-'                                           
              `-.__.-'                                               

6170:M 05 Sep 2025 04:03:26.147 # WARNING: The TCP backlog setting of 511 cannot be enforced because kern.ipc.somaxconn is set to the lower value of 128.
6170:M 05 Sep 2025 04:03:26.147 # Warning: Could not create server TCP listening socket *:6379: bind: Address already in use
6170:M 05 Sep 2025 04:03:26.147 # Failed listening on port 6379 (tcp), aborting.
> redis-cli ping
(error) NOAUTH Authentication required.
 ~/De/sEngineer/excelPilot  feature/redis !4 ?2 
> 

*Edited relevant file*

*Edited relevant file*

*User accepted the command `npx ts-node src/test-redis.ts`*

*User accepted the command `npx ts-node src/test-redis.ts`*

*User accepted the command `git add .`*

*User accepted the command `git commit -m "feat(redis): adds redis and test setup (Relates #6)"`*

*User accepted the command `git push origin feature/redis`*

*Edited relevant file*

*Viewed [README.md](file:///Users/luisfaria/Desktop/sEngineer/excelPilot/README.md) *

### User Input

files created, phase 1 done

*Updated todo list*

### Planner Response

# 🎉 Phase 1 Complete! Excellent work!

Your Redis connection is working perfectly. I can see from your test output that everything is connected and functioning. Great job with the git commit too - proper version control practices!

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

- [ ] Rate limiter class created
- [ ] Test file shows proper limiting behavior
- [ ] You understand the Redis key strategy
- [ ] You can explain why we use INCR + EXPIRE

**Ready to create these files and see rate limiting in action?**

Once this works, Phase 3 will integrate it into your [sendMessage](cci:1://file:///Users/luisfaria/Desktop/sEngineer/excelPilot/src/resolvers/conversations/mutations.ts:30:4-82:5) mutation - that's where it gets exciting! 🚀