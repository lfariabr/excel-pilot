// app.ts — pure Express app (no listening)

import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import { Request, Response, NextFunction } from "express";
import { AppError } from "./utils/errorHandler";
import mongoose from "mongoose";

import userRouter from "./routes/user";
import rateLimiterLogsRouter from "./routes/rateLimiterLogs";


export function createApp() {
    const app = express();
  
    const isDev = process.env.NODE_ENV !== "production";
  
    // Global middlewares
    app.use(cors(/* add options */));
    app.use(
      helmet(isDev ? { contentSecurityPolicy: false } : undefined)
    );
    app.use(express.json({ limit: "1mb" }));
  
    // Health endpoints
    app.get("/health", (_req, res) => res.json({ ok: true }));
    app.get("/ready", (_req, res) => {
      const up = mongoose.connection.readyState === 1;
      res.status(up ? 200 : 503).json({ mongo: up });
    });
  
    // REST
    app.use("/users", userRouter);
    app.use("/analytics", rateLimiterLogsRouter);

  // NOTE: 404 handler must be registered AFTER GraphQL attachment
  // See server.ts for proper middleware order

    // Central error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      // Log errors for monitoring (exclude 4xx client errors)
      if (!err.status || err.status >= 500) {
        console.error('Server error:', {
          message: err.message,
          stack: err.stack,
          code: err.code,
          type: err.type
        });
      }
      // Handle MongoDB duplicate key errors
      if (err?.code === 11000) {
        return res.status(409).json({ error: "Duplicate key", details: err.keyValue });
      }
      
      // Handle express.json() payload size errors
      if (err.type === "entity.too.large") {
        return res.status(413).json({ error: "Payload too large" });
      }
      
      // Handle all other errors
      const status = err instanceof AppError ? err.status : 500;
      res.status(status).json({ error: err.message || "Server error" });
    });
  
    return app;
  }