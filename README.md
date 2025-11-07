# ExcelPilot

Building an API to guide ExcelBM Concierges on their daily tasks using Node.js, Express.js, Apollo Server, MongoDB, Redis and OpenAI.

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/lfariabr/excel-pilot)

## Features Status Control:
> *Note: ✅ = done, 🔥 = in progress, ⏳ = not started*

| Feature | Status | Version |
| --- | --- | --- |
| Node.js + TypeScript | ✅ | _v0.0.1_ |
| MongoDB | ✅ | _v0.0.2_ |
| Express.js | ✅ | _v0.0.3_ |
| Apollo Server | ✅ | _v0.0.4_ |
| Index.ts Refactoring | ✅ | _v0.0.5_ |
| JWT + Auth | ✅ | _v0.0.6_ |
| OpenAI | ✅ | _v0.0.7_ |
| Redis | ✅ | _v0.0.8_ |
| OpenAI Core | ✅ | _v0.0.9_ |
| Rate Limit, Circuit Breaker, Analytics | ✅ | _v0.0.10_ |
| Jest + Testing | ✅ | _v0.0.11_ |
| Docker | 🔥 | _v0.0.12_ |
| Winston | ⏳ | TBD |

## **Detailed Changelog** 

### **DONE**:
- **v0.0.1** - Starting TypeScript Node.js project
- **v0.0.2** - Layer #1 (Database + Models): Added MongoDB connection and User model
- **v0.0.3** - Layer #2 (Express API): Set up Express Server with basic User routes (CRUD) + error handler
- **v0.0.4** - Layer #3 (GraphQL API): Set up Apollo Server with basic User queries and mutations
- **v0.0.5** - Breaks `index.ts` into `server.ts` + `app.ts` + `graphql.ts`
- **v0.0.6** - Login, Register + Authentication (JWT, password hashing, requireAuth, requireRole)
- **v0.0.7** - OpenAI client (Agent, ChatMessage)
- **v0.0.8** - Redis (Rate Limiting, Token Budget - daily and monthly per user)
- **v0.0.9** - OpenAI Core (Responses API, Cursor Pagination, Auto Title and Summary)
- **v0.0.10** - Rate Limit (Circuit Breaker, Analytics, Tiered Limits)
- **v0.0.11** - Jest + Testing: Unit tests, Integration tests, E2E tests

### **WORK IN PROGRESS**:

- **v0.0.12** - Docker
    - Containerize the app
    - Multi-stage build
    - Docker compose with MongoDB and Redis
    - Environment variables

### **BACKLOG**:

- **tbd** - Caching (Redis-based)
    - Cache similar user queries (24h TTL)
    - Cache conversation context
    - Cache system prompts and briefing data

- **tbd** - Winston
    - Request/response logging
    - Performance metrics
    - Error tracking
    - Rate limit events

- **tbd** - Study Jenkins + GitHub Actions


