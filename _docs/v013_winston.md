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
  SERVER      // Server lifecycle, startup, shutdown
  DATABASE    // MongoDB operations, connections
  AUTH        // Login, registration, JWT validation
  OPENAI      // API calls, token usage, costs
  RATE_LIMIT  // Rate limit hits, budget exhaustion
  REDIS       // Cache operations, connections
  GRAPHQL     // GraphQL queries and mutations
  REST        // REST API requests
  PERFORMANCE // Operation timing, bottlenecks
  SECURITY    // Unauthorized access, suspicious activity
}