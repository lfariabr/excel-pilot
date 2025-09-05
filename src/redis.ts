import Redis from "ioredis";

const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || "",

    // Connection pool
    retryDelayOnFailover: 100,  // Retry quickly if Redis fails
    enableReadyCheck: false,    // Don't wait for Redis to be "ready"
    maxRetriesPerRequest: null, // Keep trying forever
    lazyConnect: true,          // Don't connect immediately
};

export const redisClient = new Redis(redisConfig);

export async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('... 📖 Redis connected');
  }
  catch (err) {
    console.error('❌ Redis connection error:', err);
    process.exit(1);
  }
}

redisClient.on("ready", () => {
    // console.log("... ✅ Redis client ready")
})

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