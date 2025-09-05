import { userRateLimiter } from '../middleware/rateLimiter';

// npx ts-node src/tests/test-rate-limiter.ts

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
            resetIn: Math.ceil((result.resetTime - Date.now()) / 1000) + 's',
        })

        // Small delay to see progression
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Testing Messages rate limiting
    console.log('\n--- Messages Rate Limiting (30 per minute) ---');

    for (let i = 1; i <= 32; i++) {
        const result = await userRateLimiter.checkUserLimit(userId, 'messages');

        console.log(`Request ${i}:`, {
            allowed: result.allowed,
            remaining: result.remaining,
            resetIn: Math.ceil((result.resetTime - Date.now()) / 1000) + 's',
        })

        // Small delay to see progression
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // console.log('\n--- Waiting for reset (or test with different user) ---');

    // const result = await userRateLimiter.checkUserLimit('different-user', 'openai');
    // console.log('Different user:', {
    //     allowed: result.allowed,
    //     remaining: result.remaining
    // });
    
    process.exit(0);
}

// Run the test
testRateLimiter().catch(console.error);
