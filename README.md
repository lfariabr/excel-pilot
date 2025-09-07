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
- [ ] Paginate messages: build a cursor-based pagination system that:
    - [ ] Loads messages in chunks (e.g., 20 at a time)
    - [ ] Uses cursor (last message ID) instead of page numbers
    - [ ] Provides hasNextPage and nextCursor for infinite scroll
    - [ ] Maintains chronological order (newest first)
- [ ] add title field on askOpenAI from first assistance reply
- [ ] add summary field on conversation

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
- **tbd** - Study Jenkins + GitHub Actions


