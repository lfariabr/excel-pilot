# v0.0.13 - Winston Logging System

## Overview
Production-grade logging system using Winston with structured logging, daily file rotation, and specialized loggers for different concerns.

## Architecture

### Core Components

#### 1. **Logger Instance** (`src/utils/logger.ts`)
Centralized Winston logger with:
- Custom log levels (error, warn, info, http, debug)
- Multiple transports (console, files)
- Structured metadata support
- Category-based organization

#### 2. **Transports**
- **Console**: Real-time monitoring (always enabled)
- **Combined File**: All logs ≥ info level (14-day retention)
- **Error File**: Only errors (30-day retention for auditing)
- **HTTP File**: Request/response logs (7-day retention, high volume)

#### 3. **Formatters**
- **Development**: Pretty, colorized console output
- **Production**: Structured JSON for log aggregation tools

### Log Categories
```typescript
enum LogCategory {
  SERVER = 'server',          // Server lifecycle, startup, shutdown
  DATABASE = 'database',      // MongoDB operations, connections
  AUTH = 'auth',              // Login, registration, JWT validation
  OPENAI = 'openai',          // API calls, token usage, costs
  RATE_LIMIT = 'rate_limit',  // Rate limit hits, budget exhaustion
  REDIS = 'redis',            // Cache operations, connections
  GRAPHQL = 'graphql',        // GraphQL queries and mutations
  REST = 'rest',              // REST API requests
  PERFORMANCE = 'performance',// Operation timing, bottlenecks
  SECURITY = 'security',      // Unauthorized access, suspicious activity
}
```

### Task Breakdown
- [X] Structured logging with multiple transports (console, daily rotating files)
  - [X] Console transport (development)
  - [X] Combined file transport (info level, 14-day retention)
  - [X] Error file transport (error level, 30-day retention)
  - [X] HTTP file transport (http level, 7-day retention)
- [X] HTTP request/response logging with middleware
  - [X] Development: Pretty, colorized console output
  - [X] Production: Structured JSON for log aggregation tools
- [X] OpenAI API call tracking with token usage and cost estimation
- [X] Rate limit event logging and circuit breaker monitoring
- [ ] Performance metrics and execution time tracking
- [X] Error tracking with full stack traces and context
  - [X] Error file transport (error level, 30-day retention)
- [X] Specialized loggers for specifics auth, database, Redis, GraphQL operations
- [X] Individually specialized loggers for each operation
  - [X] Auth (`src/resolvers/auth`)
  - [X] Users (`src/resolvers/users`)
  - [X] Redis (`src/redis/redis.ts`)
    - [X] Rate limit (`src/middleware/rateLimiter.ts`)
    - [X] Rate limit health (`src/middleware/rateLimiterHealth.ts`)
  - [X] Conversations (`src/resolvers/conversations`)
  - [X] Messages (`src/resolvers/messages`)
  - [X] Database (MongoDB @ `server.ts`)
  - [X] GraphQL (Apollo @ `graphql.ts`)
- [X] REST 
  - [X] Routes (`src/routes`)
    - [X] User CRUD (`src/routes/user.ts`)
    - [X] Rate limit analytics (`src/routes/rateLimiterLogs.ts`)
- [ ] Log rotation (14-day combined, 30-day errors, 7-day HTTP)
- [ ] Add background job monitoring

```bash
# Examples
# 1- Title generation success rate
total_title_attempts=$(grep -E "(Title updated|Error.*title)" logs/combined-*.log | wc -l)
successful_titles=$(grep "Title updated for conversation" logs/combined-*.log | wc -l)
echo "Title success rate: $((successful_titles * 100 / total_title_attempts))%"

# 2- Summary generation success rate
total_summary_attempts=$(grep -E "(Summary updated|Error.*summary)" logs/combined-*.log | wc -l)
successful_summaries=$(grep "Summary updated for conversation" logs/combined-*.log | wc -l)
echo "Summary success rate: $((successful_summaries * 100 / total_summary_attempts))%"

# 3- Average summary length
grep "Summary updated for conversation" logs/combined-*.log | jq -r '.summaryLength' | awk '{sum+=$1; count++} END {print "Avg summary length:", sum/count, "chars"}'
```