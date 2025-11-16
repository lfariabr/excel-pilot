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
import { logHTTP, logGraphQL, LogMetadata } from '../utils/logger';

/**
 * HTTP Logger Middleware
 * To be placed early in Express middleware chain
 */
export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  let logged = false;

  // Helper to log once (avoid duplicate logs)
  const logRequest = (event: 'finish' | 'close') => {
    if (logged) return;
    logged = true;

    const duration = Date.now() - startTime;
    
    // Redact sensitive query parameters
    const sanitizedQuery = sanitizeQueryParams(req.query);
    
    const shouldLogDetails = process.env.LOG_DETAILED_METADATA !== 'false';

    const metadata: LogMetadata = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: shouldLogDetails ? req.get('user-agent') : undefined,
      userId: (req as any).user?.sub,
      query: shouldLogDetails && Object.keys(sanitizedQuery).length 
        ? sanitizedQuery 
        : undefined,
      event,
    };

    // Log message with appropriate detail
    const message = `${req.method} ${req.path} ${res.statusCode || 'ABORTED'} - ${duration}ms`;

    // Log based on status code
    if (event === 'close' && !res.statusCode) {
      // Request aborted/timeout
      logHTTP(`[ABORTED] ${message}`, metadata);
    } else if (res.statusCode >= 500) {
      // Server errors - always important
      logHTTP(`[ERROR] ${message}`, metadata);
    } else if (res.statusCode >= 400) {
      // Client errors - warnings
      logHTTP(`[CLIENT ERROR] ${message}`, metadata);
    } else {
      // Success - normal logging
      logHTTP(message, metadata);
    }
  };

  // Capture response when it finishes
  res.on('finish', () => logRequest('finish'));
  
  // Capture aborted/timeout requests
  res.on('close', () => logRequest('close'));

  next();
};

/**
 * Sanitize query parameters to remove sensitive data
 * Prevents logging passwords, tokens, API keys, etc.
 */
function sanitizeQueryParams(query: any): Record<string, any> {
  if (!query || typeof query !== 'object') return {};
  
  const sensitiveKeys = [
    'password',
    'token',
    'api_key',
    'apikey',
    'secret',
    'auth',
    'authorization',
    'credit_card',
    'ssn',
    'access_token',
    'refresh_token',
  ];
  
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(query)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
    
    sanitized[key] = isSensitive ? '[REDACTED]' : value;
  }
  
  return sanitized;
}

/**
 * GraphQL Operation Logger
 * To be used within Apollo Server context for GraphQL-specific logging
 * Now properly categorized as GRAPHQL (not REST)
 */
export const logGraphQLOperation = (
  operationType: 'query' | 'mutation',
  operationName: string,
  variables: any,
  userId?: string,
  duration?: number
) => {
  // Sanitize variables (might contain sensitive data)
  const sanitizedVariables = sanitizeVariables(variables);
  
  const metadata: LogMetadata = {
    userId,
    duration,
    operationType,
    operationName,
    variables: Object.keys(sanitizedVariables || {}).length ? sanitizedVariables : undefined,
  };

  // Use logGraphQL (not logHTTP) for proper categorization
  logGraphQL(`GraphQL ${operationType}: ${operationName}`, metadata);
};

/**
 * Sanitize GraphQL variables to remove sensitive data
 */
function sanitizeVariables(variables: any): Record<string, any> {
  if (!variables || typeof variables !== 'object') return {};
  
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(variables)) {
    const isSensitive = sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive.toLowerCase())
    );
    
    sanitized[key] = isSensitive ? '[REDACTED]' : value;
  }
  
  return sanitized;
}