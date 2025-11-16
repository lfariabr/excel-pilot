// server.ts — the only file that starts listening
import mongoose from "mongoose";
import http from "http";

// Express
import { createApp } from "./app";

// GraphQL / Apollo Server
import { attachGraphQL, register404Handler } from "./graphql";

// Redis
import { redisClient, connectRedis } from "./redis/redis";

// Logging
import { logger } from "./utils/logger";
import { httpLogger } from "./middleware/httpLogger";



async function start() {
    await mongoose.connect(process.env.MONGO_URI!);
    logger.info('Connected to MongoDB')

    await connectRedis();
  
    const app = createApp();
    const httpServer = http.createServer(app);
  
    // Attach HTTP logger BEFORE GraphQL
    app.use(httpLogger);
  
    // Attach GraphQL BEFORE 404 handler
    await attachGraphQL(app, httpServer);
  
    // Register 404 handler AFTER all routes
    register404Handler(app);
  
    const PORT = Number(process.env.PORT) || 4000;
    httpServer.listen(PORT, () => {
      logger.info(`... 🚀 REST ready at http://localhost:${PORT}`);
      logger.info(`... ⚙️ GraphQL ready at http://localhost:${PORT}/graphql`);
    });
  
    // Graceful shutdown
    process.on("SIGINT", () => {
      httpServer.close(() => {
        mongoose.connection.close();
        redisClient.disconnect();
        process.exit(0);
      });
    });

    process.on("SIGTERM", () => {
      httpServer.close(() => {
        mongoose.connection.close();
        redisClient.disconnect();
        process.exit(0);
      });
    });
  }
  
  start().catch((e) => {
    logger.error("Fatal startup error:", { error: e });
    process.exit(1);
  });