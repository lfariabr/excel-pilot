import { userRateLimiter } from '../middleware/rateLimiter';
import { TokenEstimator } from '../utils/tokenEstimator';

// npx ts-node src/tests/test-token-budget.ts

async function testTokenBudget() {
    const userId = 'test-user-token';

    console.log('🧪 Testing token budget simulation...\n');

    // simulate diff message sizes
    const testMessages = [
        { content: 'Hi', expectedTokens: ~50 },
        { content: 'Write a long essay about AI and its implications for society, covering multiple aspects and providing detailed analysis.', expectedTokens: ~500 },
        { content: 'x'.repeat(1000), expectedTokens: ~250 },
    ];

    for (const msg of testMessages) {
        console.log(`--- Testing message: "${msg.content.substring(0, 50)}..." ---`);
        
        const estimatedTokens = TokenEstimator.estimateTokens(msg.content, []);
        console.log(`Estimated tokens: ${estimatedTokens}`);

        const budgetResult = await userRateLimiter.checkUserTokenBudget(userId, estimatedTokens);
        console.log(`Budget check:`, {
            allowed: budgetResult.allowed,
            remaining: budgetResult.remaining,
            resetIn: Math.ceil((budgetResult.resetTime - Date.now()) / (1000 * 60 * 60)) + 'h'
        });
        
        console.log('');
    }

    // test budget exceeded
    console.log('--- Testing budget exhaustion ---');
    const hugeBudget = 60000; // More than daily limit
    const budgetResult = await userRateLimiter.checkUserTokenBudget(userId, hugeBudget);
    console.log('Huge request result:', budgetResult);
    console.log('');
    
    process.exit(0);
}

// run test
testTokenBudget().catch(console.error);

        
        