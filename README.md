# ExcelPilot

Building an API to guide ExcelBM Concierges on their daily tasks using Node.js, Express.js, Apollo Server, MongoDB, Redis and OpenAI.

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
| OpenAI | ✅ | _v0.0.7_ |
| Redis | ✅ | _v0.0.8_ |
| Docker | 🏗️🧱🔨 | TBD |
| Winston | 🏗️🧱🔨 | TBD |

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

### **WORK IN PROGRESS**:
- **v0.0.9** - OpenAI Core
- [X] persist messages on askOpenAI
    - [X] OpenAI service updated to Chat Completions API
    - [X] Usage field mapping fixed
    - [X] Test shows proper responses and usage tracking
    - [X] No more persistence errors in sendMessage
- [X] study OpenAI Responses API
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
- [X] add title field on askOpenAI from first assistance reply
    - [X] Update conversation model with the field
    - [X] Create titleGenerator.ts with generateConversationTitle and updateConversationTitle functions
    - [X] Wired up the titleGenerator to conversations (startConversation and sendMessage mutations)
    - [X] Refactored startConversation to use askOpenAI instead of simply receiving "title" from user
    - [X] Test titleGenerator on a file
- [ ] add summary field on conversation
    - [X] Add summary field to conversation type
    - [X] Create summaryGenerator.ts with generateConversationSummary and updateConversationSummary functions
    - [ ] Wired up the summaryGenerator to conversations (sendMessage mutations - logic is going to be to generate summaries after 10+ messages and keep it updated on the go - 5 messages after that)
    - [ ] Background processing, so we don't block the main thread
    - [ ] Test summaryGenerator on a file

### **BACKLOG**:

- **tbd** - Caching (Redis-based)
    - Cache similar user queries (24h TTL)
    - Cache conversation context
    - Cache system prompts and briefing data

- **tbd** - Docker
    - Containerize the app
    - Multi-stage build
    - Docker compose with MongoDB and Redis
    - Environment variables

- **tbd** - Winston
    - Request/response logging
    - Performance metrics
    - Error tracking
    - Rate limit events

- **tbd** - Jest + Testing
    - Unit tests
    - Integration tests
    - E2E tests

- **tbd** - Study Jenkins + GitHub Actions


