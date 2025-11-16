/**
 * Express Middleware for HTTP Request/Response Logging
 *
 * Captures:
 * - Request method, path, query params, headers
 * - Response status code, duration
 * - User context (if authenticated)
 * - IP address and user agent
 *
 * Automatically logs every request to API
 */

import { Request, Response, NextFunction } from 'express';
import { logHTTP, LogMetadata } from '../utils/logger';

/**
 * HTTP Logger Middleware
 * To be placed early in Express middleware chain
 */
export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Capture response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const metadata: LogMetadata = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      userId: (req as any).user?.id, // From JWT middleware
      query: Object.keys(req.query).length ? req.query : undefined,
    };

    // Log message with appropriate detail
    const message = `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;

    // Log based on status code
    if (res.statusCode >= 500) {
      // Server errors - always important
      logHTTP(`[ERROR] ${message}`, metadata);
    } else if (res.statusCode >= 400) {
      // Client errors - warnings
      logHTTP(`[CLIENT ERROR] ${message}`, metadata);
    } else {
      // Success - normal logging
      logHTTP(message, metadata);
    }
  });

  next();
};

/**
 * GraphQL Operation Logger
 * To be used within Apollo Server context for GraphQL-specific logging
 */
export const logGraphQLOperation = (
  operationType: 'query' | 'mutation',
  operationName: string,
  variables: any,
  userId?: string,
  duration?: number
) => {
  const metadata: LogMetadata = {
    userId,
    duration,
    operationType,
    operationName,
    variables: Object.keys(variables || {}).length ? variables : undefined,
  };

  logHTTP(`GraphQL ${operationType}: ${operationName}`, metadata);
};