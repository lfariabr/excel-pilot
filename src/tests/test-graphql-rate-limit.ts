import { userRateLimiter } from '../middleware/rateLimiter';

// npx ts-node src/tests/test-graphql-rate-limit.ts

async function testGraphQLRateLimit() {
    const userId = 'test-user-graphql';
    
    console.log('🧪 Testing GraphQL rate limiting simulation...\n');

    // Simulate what happen in sendMessage mutation
    for (let i = 1; i <= 12; i++ ) {
        console.log(`--- Simulated sendMessage Request ${i} ---`);
        
        // This is what your mutation will do
        const rateLimitResult = await userRateLimiter.checkUserLimit(userId, 'messages');
        console.log('Rate limit result:', rateLimitResult);

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

// Run the test
testGraphQLRateLimit().catch(console.error);
