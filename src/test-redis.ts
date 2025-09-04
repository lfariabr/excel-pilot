import redisClient from "./redis";

// npx ts-node src/test-redis.ts

async function testRedis() {
    try {
        console.log("Testing Redis connection...");

        await redisClient.set('test:connnection', 'working!');
        const result = await redisClient.get('test:connnection');

        console.log('✅ Redis test result:', result);

        await redisClient.del('test:connnection');

        process.exit(0);
    } catch (error) {
        console.error('❌ Redis test error:', error);
        process.exit(1);
    }
}

// Run the test
testRedis();
