# ExcelPilot

Building an API to guide ExcelBM Concierges on their daily tasks using Node.js, Express.js, Apollo Server and MongoDB.

## Tech Stack & Version Control:
| Tech | Status | Version |
| --- | --- | --- |
| Node.js | ✅ | _v0.0.1_ |
| TypeScript | ✅ | _v0.0.1_ |
| MongoDB | ✅ | _v0.0.2_ |
| Express.js | ✅ | _v0.0.3_ |
| Apollo Server v1 | ✅ | _v0.0.4_ |
| Apollo Server v2 | ✅ | _v0.0.5_ |
| JWT + Auth | ✅ | _v0.0.6_ |
| OpenAI | 🏗️🧱🔨 | TBD |
| Redis | 🏗️🧱🔨 | TBD |
| Docker | 🏗️🧱🔨 | TBD |

## **Detailed Changelog** 

### **DONE**:
- **v0.0.1** - Starting TypeScript Node.js project
- **v0.0.2** - Layer #1 (Database + Models): Added MongoDB connection and User model
- **v0.0.3** - Layer #2 (Express API): Set up Express Server with basic User routes (CRUD) + error handler
- **v0.0.4** - Layer #3 (GraphQL API): Set up Apollo Server with basic User queries and mutations
- **v0.0.5** - Breaks `index.ts` into `server.ts` + `app.ts` + `graphql.ts`
- **v0.0.6** - Login, Register + Authentication (JWT, password hashing, requireAuth, requireRole)
- **v0.0.7** - OpenAI client (Agent, ChatMessage)

### **WORK IN PROGRESS**:

- **v0.0.8** - Redis
> Goal: Implement rate limiting on sendMessage mutation that calls OpenAI.
- [X] install dependencies: npm install express-rate-limit rate-limit-redis ioredis @types/ioredis --legacy-peer-deps
- [X] Create `redis.ts` file and test connection
- [X] Create `test-redis.ts` file to validate connection
- [X] Implement rate limiting middleware (`UserRateLimiter`)
- [X] Create `test-rate-limiter.ts` file to validate usage
- [X] add rate limiting check to send Message mutation
- [X] Create `test-graphql-rate-limit.ts` file to validate usage
- [ ] estimate token usage before calling OpenAI

### **BACKLOG**:
- **tbd** - Caching
- **tbd** - Docker
- **tbd** - Winston + Logging

