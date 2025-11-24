# ExcelPilot 🚀

**A production-grade API for non-technical users to interact with OpenAI's specialized agents through structured conversations.**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9.2-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-254%20passing-success)](https://jestjs.io/)
[![Coverage](https://img.shields.io/badge/coverage-85%25-green)](#testing)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![CodeRabbit](https://img.shields.io/coderabbit/prs/github/lfariabr/excel-pilot)](https://coderabbit.ai)

---

## 📚 Table of Contents

- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Architecture](#️-architecture)
- [Getting Started](#-getting-started)
- [API Examples](#-api-examples)
- [Configuration](#️-configuration)
- [Testing](#-testing)
- [Roadmap](#️-roadmap)
- [Contributing](#-contributing)

---

## ✨ Features

### Core Functionality
- 🔐 **Authentication & Authorization** - JWT-based auth with role-based access control
- 💬 **Conversation Management** - Multi-threaded conversations with OpenAI agents
- 🤖 **AI Integration** - Specialized OpenAI agents with context awareness
- 📊 **Auto-generated Metadata** - Smart titles and summaries for conversations
- 📄 **Cursor Pagination** - Efficient navigation through large conversation histories

### Production-Ready Features
- 🚦 **Rate Limiting** - Per-user request limits and token budgets (50K daily, 1M monthly)
- 🔄 **Circuit Breaker** - Automatic failover and Redis health monitoring
- 📈 **Analytics** - Track API usage, rate limit violations, and token consumption
- 📝 **Structured Logging** - Winston-based logging with daily rotation (14/30/7 day retention)
- 🐳 **Docker Support** - Multi-stage builds and Docker Compose orchestration
- ✅ **Comprehensive Testing** - 254 tests covering unit, integration, and E2E scenarios
- 🎯 **Dual API** - REST for simple operations, GraphQL for complex queries

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18+ with TypeScript 5.9
- **Web Framework:** Express.js 5.0
- **GraphQL:** Apollo Server v4
- **Database:** MongoDB with Mongoose ODM
- **Caching & Rate Limiting:** Redis 7.x
- **AI:** OpenAI API (GPT-4)

### DevOps & Tooling
- **Testing:** Jest + Supertest + MongoDB Memory Server
- **Logging:** Winston with daily file rotation
- **Containerization:** Docker + Docker Compose
- **Code Quality:** ESLint + Prettier
- **Version Control:** Git with Conventional Commits

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                      │
│  ┌──────────────┐              ┌────────────────────────┐   │
│  │  Express.js  │              │   Apollo GraphQL       │   │
│  │  (REST API)  │              │   (GraphQL API)        │   │
│  └──────────────┘              └────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Middleware Layer                        │
│  • Authentication (JWT)                                     │
│  • Rate Limiting (Redis-backed)                             │
│  • Circuit Breaker & Health Checks                          │
│  • Winston Structured Logging                               │
│  • Error Handling & Validation                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic                         │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌─────────┐   │
│  │   Auth   │  │  Users   │  │Conversations│  │Messages │   │
│  │ Resolvers│  │Resolvers │  │ Resolvers   │  │Resolvers│   │
│  └──────────┘  └──────────┘  └─────────────┘  └─────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                            │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐   │
│  │   MongoDB    │   │    Redis     │   │  OpenAI API    │   │
│  │  (Primary)   │   │(Rate Limit)  │   │  (AI Agent)    │   │
│  └──────────────┘   └──────────────┘   └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions
- **Dual API Pattern:** REST for simple CRUD operations, GraphQL for complex queries with nested data
- **Redis-backed Rate Limiting:** Prevents API abuse and controls OpenAI costs
- **Circuit Breaker Pattern:** Graceful degradation when Redis is unavailable (fail-open strategy)
- **Token Budget Enforcement:** Daily (50K) and monthly (1M) token limits per user
- **Background Jobs:** Asynchronous title and summary generation using OpenAI
- **Cursor Pagination:** Efficient handling of large datasets in conversations

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **MongoDB** 6.0+
- **Redis** 7.0+
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))

### Installation

#### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/lfariabr/excel-pilot.git
cd excel-pilot

# Copy environment template
cp .env.example .env
# Edit .env with your OpenAI API key and other settings

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app
```

#### Option 2: Manual Setup

```bash
# Clone the repository
git clone https://github.com/lfariabr/excel-pilot.git
cd excel-pilot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Start MongoDB (in separate terminal)
mongod --dbpath ./data/db

# Start Redis (in separate terminal)
redis-server

# Start the application
npm run dev
```

### Quick Commands

```bash
# Development
npm run dev          # Start with hot reload (ts-node-dev)
npm run build        # Build TypeScript to JavaScript
npm start            # Run production build

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Docker
docker-compose up    # Start all services
docker-compose down  # Stop all services
docker-compose logs  # View logs
```

### Verify Installation

Once running, you should see:
```
2025-11-24 04:24:18 info  Connected to MongoDB
2025-11-24 04:24:18 debug [redis] Redis connected successfully
2025-11-24 04:24:18 info  ... 🚀 REST ready at http://localhost:4000
2025-11-24 04:24:18 info  ... ⚙️ GraphQL ready at http://localhost:4000/graphql
```

**Server will be available at:**
- **REST API:** `http://localhost:4000`
- **GraphQL Playground:** `http://localhost:4000/graphql`

---

## 📡 API Examples

### REST API

#### Register a New User
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepass123",
    "role": "casual"
  }'
```

#### Login
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepass123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "674abc123...",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "casual"
  }
}
```

#### Get All Users (Authenticated)
```bash
curl http://localhost:4000/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### GraphQL API

Visit `http://localhost:4000/graphql` for the interactive playground.

#### Start a New Conversation
```graphql
mutation {
  startConversation(content: "Hello! Can you help me with Excel formulas?") {
    id
    content
    role
    aiModel
    createdAt
    usage {
      inputTokens
      outputTokens
      totalTokens
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "startConversation": {
      "id": "674abc123def456",
      "content": "Hello! I'd be happy to help you with Excel formulas...",
      "role": "assistant",
      "aiModel": "gpt-4",
      "createdAt": "2025-11-24T04:30:00.000Z",
      "usage": {
        "inputTokens": 150,
        "outputTokens": 200,
        "totalTokens": 350
      }
    }
  }
}
```

#### Send a Message in Existing Conversation
```graphql
mutation {
  sendMessage(
    conversationId: "674abc123def456"
    content: "How do I use VLOOKUP?"
  ) {
    id
    content
    role
    aiModel
    usage {
      totalTokens
    }
  }
}
```

#### Get Your Conversations (with Pagination)
```graphql
query {
  conversations(first: 10) {
    edges {
      node {
        id
        title
        summary
        lastMessageAt
        createdAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
```

#### Get Messages in a Conversation
```graphql
query {
  messages(conversationId: "674abc123def456", first: 20) {
    edges {
      node {
        id
        content
        role
        aiModel
        createdAt
        usage {
          totalTokens
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

#### Check Rate Limit Status
```graphql
query {
  rateLimitStatus {
    requestLimit {
      allowed
      remaining
      resetTime
    }
    tokenBudget {
      allowed
      remaining
      resetTime
    }
  }
}
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Server Configuration
PORT=4000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/excelpilot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=7d

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=10
DAILY_TOKEN_BUDGET=50000
MONTHLY_TOKEN_BUDGET=1000000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

# Logging
LOG_LEVEL=debug
LOG_DIR=logs
```

### Rate Limiting Configuration

- **Request Limit:** 10 requests per minute per user
- **Token Budget:** 
  - Daily: 50,000 tokens
  - Monthly: 1,000,000 tokens
- **Circuit Breaker:** Opens after 5 consecutive Redis failures
- **Strategy:** Fail-open (allows requests when Redis is down)

### Logging Configuration

Winston logs are stored in `logs/` directory:
- **combined-YYYY-MM-DD.log** - All logs (14-day retention)
- **error-YYYY-MM-DD.log** - Error logs only (30-day retention)
- **http-YYYY-MM-DD.log** - HTTP request logs (7-day retention)

---

## 🧪 Testing

### Test Coverage
- **254 tests** across unit, integration, and E2E
- **85%+ code coverage**
- **MongoDB Memory Server** for isolated database testing
- **Comprehensive mocking** for external dependencies (OpenAI, Redis)

### Test Structure
```
src/__tests__/
├── auth/              # Authentication & JWT tests
│   ├── jwt.test.ts
│   ├── guards.test.ts
│   └── mutations.test.ts
├── conversations/     # Conversation CRUD tests
│   ├── Conversation.test.ts
│   ├── Mutations.test.ts
│   └── Queries.test.ts
├── messages/          # Message handling tests
│   ├── Message.test.ts
│   ├── Mutations.test.ts
│   └── Queries.test.ts
├── rateLimit/         # Rate limiting & circuit breaker
│   ├── rateLimiter.test.ts
│   ├── rateLimiterHealth.test.ts
│   └── rateLimitAnalytics.test.ts
├── services/          # OpenAI integration tests
│   ├── openAi.test.ts
│   ├── titleGenerator.test.ts
│   └── summaryGenerator.test.ts
└── models/            # Database model tests
    └── User.test.ts
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode (for development)
npm run test:watch

# Run specific test suite
npm test -- auth
npm test -- messages
npm test -- rateLimit

# Run specific test file
npm test -- src/__tests__/auth/jwt.test.ts
```

### Test Output Example
```
Test Suites: 21 passed, 21 total
Tests:       254 passed, 254 total
Snapshots:   0 total
Time:        20.896 s
```

---

## 🗓️ Roadmap

### ✅ Completed (v0.0.1 - v0.0.13)

| Version | Feature | Description |
|---------|---------|-------------|
| v0.0.1 | Node.js + TypeScript | Project foundation with TypeScript setup |
| v0.0.2 | MongoDB | Database layer with Mongoose models |
| v0.0.3 | Express.js | REST API with CRUD operations |
| v0.0.4 | Apollo Server | GraphQL API with queries and mutations |
| v0.0.5 | Architecture Refactor | Separated server, app, and GraphQL layers |
| v0.0.6 | JWT + Auth | Authentication with role-based access |
| v0.0.7 | OpenAI Client | Initial OpenAI integration |
| v0.0.8 | Redis | Rate limiting and token budget tracking |
| v0.0.9 | OpenAI Core | Cursor pagination, auto titles/summaries |
| v0.0.10 | Advanced Rate Limiting | Circuit breaker, analytics, health checks |
| v0.0.11 | Jest Testing | 254 comprehensive tests |
| v0.0.12 | Docker | Containerization and orchestration |
| v0.0.13 | Winston Logging | Production-grade structured logging |

### 🚧 Upcoming Features

#### v0.0.14 - AI Agent Enhancements
- Natural language intent recognition
- Enhanced context awareness
- Conversation history optimization
- Multi-turn conversation improvements

#### v0.0.15 - Performance & Caching
- Redis-based query caching (24h TTL)
- Conversation context caching
- System prompt caching
- Database query optimization and indexing

#### v0.0.16 - Monitoring & Observability
- Prometheus metrics integration
- Grafana dashboards
- Health check endpoints
- Performance monitoring

#### v0.0.17 - CI/CD & Automation
- GitHub Actions pipeline
- Automated testing on PR
- Automated deployment
- Code quality checks

#### Future Considerations
- API versioning
- Webhook support for async operations
- Admin dashboard UI
- OpenAPI/Swagger documentation
- Multi-language support
- Advanced analytics and reporting

---

## 🤝 Contributing

Contributions are welcome! Guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
   - Write tests for new features
   - Ensure all tests pass: `npm test`
   - Follow existing code style
4. **Commit using Conventional Commits**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

---

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for the powerful GPT API
- [Apollo GraphQL](https://www.apollographql.com/) for the excellent GraphQL server
- [Redis](https://redis.io/) for high-performance caching and rate limiting
- The [Node.js](https://nodejs.org/en) and [TypeScript](https://www.typescriptlang.org/) communities for amazing tools and libraries

---

## Support

If you have questions or need help:
- Open an [Issue](https://github.com/lfariabr/excel-pilot/issues)
- Check existing [Discussions](https://github.com/lfariabr/excel-pilot/discussions)
- Review the [Documentation](_docs/)

---

> “Whether it’s concrete or code, structure is everything.”


