import Redis from "ioredis";
import { logRedis, logError } from "../utils/logger";

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
    logRedis('Redis connected successfully', {
      host: redisConfig.host,
      port: redisConfig.port
    });
  }
  catch (err) {
    logError('Redis connection failed', err as Error, {
      host: redisConfig.host,
      port: redisConfig.port
    });
    process.exit(1);
  }
}

redisClient.on("ready", () => {
    logRedis('Redis client ready', {
      host: redisConfig.host,
      port: redisConfig.port
    });
})

redisClient.on('error', (err) => {
    logError('Redis client error', err, {
      host: redisConfig.host,
      port: redisConfig.port
    });
  });
  
  redisClient.on('close', () => {
    logRedis('Redis client connection closed', {
      host: redisConfig.host,
      port: redisConfig.port
    });
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    redisClient.disconnect();
  });
  
  process.on('SIGTERM', () => {
    redisClient.disconnect();
  });
  
export default redisClient;