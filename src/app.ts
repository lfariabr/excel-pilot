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
  
    // Central error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      if (err?.code === 11000) return res.status(409).json({ error: "Duplicate key", details: err.keyValue });
      const status = err instanceof AppError ? err.status : 500;
      res.status(status).json({ error: err.message || "Server error" });
    });
  
    return app;
  }