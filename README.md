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

### **Next** (TODO):
- **v0.0.7** - OpenAI client (Agent, ChatMessage)
    - [X] Create openAI service
    - [X] Create model for Conversation and Message
    - [X] Create GraphQL types to expose endpoints
    - [X] Create resolvers (queries) integrated with ctx
    - [X] Create resolvers (mutations) integrated with ctx
    - [X] Run tests on Apollo Server
    - [X] Create dateFormatter for timestamps on queries
    - [X] Conversation list should be sorted by lastMessageAt descending
    - [X] Messages should be sorted by createdAt descending
    - [ ] Persist messages on askOpenAI
    - [ ] Paginate messages on Query
    - [ ] Plan on rate limiting on askOpenAI
    - [ ] Add "title" field on askOpenAI from the first assistance reply
- **tbd** - Redis + Caching
- **tbd** - Docker
- **tbd** - Winston + Logging

