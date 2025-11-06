# ExcelPilot Changelog

---
**v0.0.2** - Layer 1 (Database + Models): MongoDB
> Goal: Set up MongoDB adding connection and User model

- [X] Install Mongoose
- [X] Create User Model
- [X] Create User Schema

---

**v0.0.3** - Layer 2 (Express API)
> Goal: Set up Express Server with basic User routes (CRUD)

- [X] Install dependecies and package.json dev script
```typescript
npm i express mongoose cors helmet
npm i -D typescript ts-node-dev @types/node @types/express
```
- [X] Import express, use cors, helmet and usersRouter
- [X] Use /health for monitoring
- [X] Configure dotenv lib + .env
- [X] Create simple CRUD
- [X] Run server on port 4000
- [X] Test via cURL

---

**v0.0.4** - Layer 3 (Apollo Server + GraphQL API)
> Goal: Set up Apollo Server with basic User queries and mutations

- [X] Install Apollo Server
```typescript
npm i @apollo/server @apollo/client graphql
```
- [X] typeDefs
- [X] resolvers with Query and Mutation
- [X] mount Apollo on existing Express server
- [X] run a test Mutation
- [X] expose apollo's playground

---

**v0.0.5** - Refactoring Index
> Goal: `index.ts` was getting too big, so we break it into smaller files

- [X] We break `index.ts` into `server.ts` + `app.ts` + `graphql.ts`
- [X] app.ts mounts the **Express app**
- [X] graphql.ts mounts the **Apollo server**
- [X] later on we can add `redis.ts` and plug it into the server
- [X] **server.ts** wires everything together and runs application

---

**v0.0.6** - Layer 4 (Authentication)
> Goal: Implement authentication using JWT and password hashing.

- [X] feat(auth-model): add password hash & compare
- [X] feat(jwt): add sign/verify helpers
- [X] feat(graphql-auth): add register/login/me + context user
- [X] feat(guards): add requireAuth/requireRole & protect admin-only paths
- [X] chore(docs): update README with auth usage & Playground examples

---

**v0.0.7** - OpenAI client (Agent, ChatMessage)
> Goal: Implement OpenAI client to handle conversations and messages.

- [X] Create openAI service
- [X] Create model for Conversation and Message
- [X] Create GraphQL types to expose endpoints
- [X] Create resolvers (queries) integrated with ctx
- [X] Create resolvers (mutations) integrated with ctx
- [X] Run tests on Apollo Server
- [X] Create dateFormatter for timestamps on queries
- [X] Conversation list should be sorted by lastMessageAt descending
- [X] Messages should be sorted by createdAt descending
- [X] Plan on rate limiting on askOpenAI
- [X] Recharge openAI credits (plus 10 USD)
- [X] Plan on .json tune up based on Opera House for testing
- [X] Run tests on OpenAI service and map results
- [X] Send different messages on same conversation to check if responses follow the same conversation
- [X] Search different conversation and see different responses
- [X] Persist messages on askOpenAI
- [X] Paginate messages on Query

---

**v0.0.8** - Redis
> Goal: Implement rate limiting on sendMessage mutation that calls OpenAI.

- [X] install dependencies: 
```typescript
npm install express-rate-limit rate-limit-redis ioredis @types/ioredis --legacy-peer-deps
```
- [X] Create `redis.ts` file and test connection
- [X] Create `test-redis.ts` file to validate connection
- [X] Implement rate limiting middleware (`UserRateLimiter`)
- [X] Create `test-rate-limiter.ts` file to validate usage
- [X] add rate limiting check to send Message mutation
- [X] Create `test-graphql-rate-limit.ts` file to validate usage
- [X] Estimate token usage before calling OpenAI
- [X] Add Token Budget to Rate Limiter (`checkUserTokenBudget`)
- [X] Creates a helper function to estimate token usage (`estimateTokenUsage`)
- [X] Add token estimator to `sendMessage` mutation
- [X] Create `test-token-estimator.ts` file to validate usage

---

**v0.0.9** - OpenAI
> Goal: Optimize service for persistence and pagination.

- [X] persist messages on askOpenAI
    - [X] OpenAI service updated to Chat Completions API
    - [X] Usage field mapping fixed
    - [X] Test shows proper responses and usage tracking
    - [X] No more persistence errors in sendMessage
- [X] Study OpenAI Responses API
    - [X] update askOpenAI to use OpenAI Responses API
    - [X] Revert openAI service to responses API
    - [X] Update Message model to match usage field
    - [X] Fix multi-turn conversation handling
    - [X] Update tests and Run
- [X] Paginate messages: build a cursor-based pagination system that:
    - [X] Loads messages in chunks (e.g., 20 at a time)
    - [X] Uses cursor (last message ID) instead of page numbers
    - [X] Provides hasNextPage and nextCursor for infinite scroll
    - [X] Maintains chronological order (newest first)
    - [X] Update GraphQL schema adding MessageConnection, MessageEdge and PageInfo types
    - [X] Create utils/pagination.ts with cursor-based pagination logic and connection builder
    - [X] Update resolvers (message query) to use cursor-based pagination
    - [X] Create test-pagination.ts and run it
- [X] Add title field on askOpenAI from first assistance reply
    - [X] Update conversation model with the field
    - [X] Create titleGenerator.ts with generateConversationTitle and updateConversationTitle functions
    - [X] Wired up the titleGenerator to conversations (startConversation and sendMessage mutations)
    - [X] Refactored startConversation to use askOpenAI instead of simply receiving "title" from user
    - [X] Test titleGenerator on a file
- [X] Add summary field on conversation
    - [X] Add summary field to conversation type
    - [X] Create summaryGenerator.ts with generateConversationSummary and updateConversationSummary functions
    - [X] Wired up the summaryGenerator to conversations (sendMessage mutations - logic is going to be to generate summaries after 10+ messages and keep it updated on the go - 5 messages after that)
    - [X] Background processing, so we don't block the main thread
    - [X] Test summaryGenerator on a file

---

**v0.0.10** - Rate Limit v2 (refactor)
> Goal: Refactor rate limiter to improve performance and accuracy.

- [X] Add Conversation-Specific Rate Limiting
- [X] Separate Rate Limit Concerns (message and conversation)
- [X] Add Tiered/Role-Based Rate Limiting
- [X] Add Rate Limit Analytics
- [X] Improve Error Messages with Actionable Guidance
- [X] Add Redis Health Check & Circuit Breaker
- [X] Add Rate Limit Bypass for Admin/Testing
- [X] Clean up old 'openai' rate limit code
- [X] Update tests for new limits

---

**v0.0.11** - Jest + Testing
> Goal: Implement comprehensive testing with Jest to ensure code quality and prevent regressions.

- [X] Set up Jest with TypeScript support
- [X] Configure Jest to work with GraphQL and MongoDB
- [X] Add unit tests for core functions (auth, rate limiting, OpenAI integration)
- [X] Add integration tests for API endpoints
- [X] Add E2E tests for complete user flows
- [X] Implement test coverage reporting
- [X] Add mock implementations for external services (OpenAI, Redis)
- [X] Create test database for isolated testing
- [X] Add CI/CD pipeline with Jest tests

