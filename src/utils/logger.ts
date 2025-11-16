/**
 * Production-Grade Winston Logger
 * 
 * Features:
 * - Structured JSON logging for production
 * - Pretty console logging for development
 * - Daily rotating file transports
 * - Separate error log files
 * - Performance tracking
 * - Request/response logging
 * - OpenAI API call tracking
 * - Rate limit event logging
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);
const APP_VERSION = packageJson.version;

// ============================================
// TYPES & ENUMS
// ============================================

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
}

export enum LogCategory {
  SERVER = 'server',
  DATABASE = 'database',
  AUTH = 'auth',
  OPENAI = 'openai',
  RATE_LIMIT = 'rate_limit',
  REDIS = 'redis',
  GRAPHQL = 'graphql',
  REST = 'rest',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
}

export interface LogMetadata {
  category?: LogCategory;
  userId?: string;
  conversationId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  error?: Error | string;
  stack?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
    cost?: number;
  };
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: Date;
  };
  [key: string]: any;
}

// ============================================
// CONFIGURATION
// ============================================

const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Custom log levels with priorities
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  },
};

winston.addColors(customLevels.colors);

// ============================================
// FORMATTERS
// ============================================

/**
 * Development formatter - Pretty, colorized console output
 * Example: "2025-11-15 06:23:45 info [openai] Chat completion successful"
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
    const categoryStr = category ? `[${category}]` : '';
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level} ${categoryStr} ${message}${metaStr}`;
  })
);

/**
 * Production formatter - Structured JSON for log aggregation
 * Example: {"timestamp":"2025-11-15T09:23:45.123Z","level":"info","message":"Chat completion"}
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ============================================
// TRANSPORTS
// ============================================

/**
 * Console transport - Always enabled for real-time monitoring
 */
const consoleTransport = new winston.transports.Console({
  format: IS_PRODUCTION ? prodFormat : devFormat,
});

/**
 * Combined log file - Daily rotation, keeps 14 days
 * Stores all logs (info and above)
 */
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: prodFormat,
  level: 'info',
});

/**
 * Error log file - Separate errors for quick debugging
 * Keeps 30 days for compliance/audit
 */
const errorFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: prodFormat,
  level: 'error',
});

/**
 * HTTP log file - Request/response tracking
 * 50MB size, 7 days retention (high volume)
 */
const httpFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '7d',
  format: winston.format.combine(
    winston.format((info) => {
      // Only log messages with level exactly 'http'
      return info.level === 'http' ? info : false;
    })(),
    prodFormat
  ),
  level: 'http',
});

// ============================================
// CORE LOGGER INSTANCE
// ============================================

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: LOG_LEVEL,
  defaultMeta: {
    service: 'excel-pilot',
    environment: process.env.NODE_ENV || 'development',
    version: APP_VERSION,
  },
  transports: [
    consoleTransport,
    ...(IS_PRODUCTION ? [combinedFileTransport, errorFileTransport, httpFileTransport] : []),
  ],
  exitOnError: false, // Don't crash on logging errors
});

// ============================================
// SPECIALIZED LOGGING FUNCTIONS
// ============================================

/**
 * Log HTTP requests with full context
 * Use in Express middleware for every request/response
 */
export const logHTTP = (message: string, metadata: LogMetadata) => {
  logger.http(message, {
    category: LogCategory.REST,
    ...metadata,
  });
};

/**
 * Log OpenAI API calls with token tracking
 * CRITICAL for cost monitoring and debugging
 */
export const logOpenAI = (message: string, metadata: LogMetadata) => {
  logger.info(message, {
    category: LogCategory.OPENAI,
    ...metadata,
  });
};

/**
 * Log rate limit events
 * Helps identify abuse patterns and adjust limits
 */
export const logRateLimit = (message: string, metadata: LogMetadata) => {
  logger.warn(message, {
    category: LogCategory.RATE_LIMIT,
    ...metadata,
  });
};

/**
 * Log performance metrics
 * Track slow operations, optimize bottlenecks
 */
export const logPerformance = (
  operation: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, any>
) => {
  const level: LogLevel.WARN | LogLevel.INFO =
  duration > 1000 ? LogLevel.WARN : LogLevel.INFO;

  logger.log(level, `Performance: ${operation}`, {
    category: LogCategory.PERFORMANCE,
    duration,
    success,
    ...metadata,
});
};

/**
 * Log authentication events
 * Track logins, failed attempts, token refreshes
 */
export const logAuth = (message: string, metadata: LogMetadata) => {
  logger.info(message, {
    category: LogCategory.AUTH,
    ...metadata,
  });
};

/**
 * Log database operations
 * Debug queries, connection issues
 */
export const logDatabase = (message: string, metadata: LogMetadata) => {
  logger.debug(message, {
    category: LogCategory.DATABASE,
    ...metadata,
  });
};

/**
 * Log Redis operations
 * Monitor cache hits/misses, connection health
 */
export const logRedis = (message: string, metadata: LogMetadata) => {
  logger.debug(message, {
    category: LogCategory.REDIS,
    ...metadata,
  });
};

/**
 * Log GraphQL operations
 * Track queries, mutations, and errors
 */
export const logGraphQL = (message: string, metadata: LogMetadata) => {
  logger.info(message, {
    category: LogCategory.GRAPHQL,
    ...metadata,
  });
};

/**
 * Log security events
 * Unauthorized access, suspicious patterns
 */
export const logSecurity = (message: string, metadata: LogMetadata) => {
  logger.warn(message, {
    category: LogCategory.SECURITY,
    ...metadata,
  });
};

/**
 * Log errors with full stack traces
 * Centralized error logging with context
 */
export const logError = (message: string, error: Error | string, metadata?: LogMetadata) => {
  const errorDetails =
    error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : { message: error };

  logger.error(message, {
    ...errorDetails,
    ...metadata,
  });
};

/**
 * Time a function execution and log performance
 * Wrapper for automatic performance tracking
 * 
 * Example:
 * const result = await timeExecution('fetchUser', async () => {
 *   return await User.findById(id);
 * }, { userId: id });
 */
export const timeExecution = async <T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  const start = Date.now();
  let success = true;

  try {
    const result = await fn();
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - start;
    logPerformance(operation, duration, success, metadata);
  }
};

// ============================================
// STARTUP LOGGING
// ============================================

logger.info('Winston logger initialized', {
  category: LogCategory.SERVER,
  logLevel: LOG_LEVEL,
  environment: process.env.NODE_ENV,
  logDir: LOG_DIR,
  transports: logger.transports.map((t) => t.constructor.name),
});

// ============================================
// EXPORTS
// ============================================

export { logger };
export default logger;