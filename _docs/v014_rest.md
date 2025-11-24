# v0.0.14 - REST API Endpoints

## Overview
Standard REST API endpoints for user management, conversation handling, and message operations with proper authentication, rate limiting, and structured logging. 
All endpoints are instrumented with Winston logging for monitoring and debugging, providing detailed request/response tracking and error logging for production observability.

## Endpoints

### User Management
- `GET /users` - List all users ✅
- `GET /users/:id` - Get user by ID ✅
- `POST /users` - Create new user ✅
- `PUT /users/:id` - Update user ✅
- `DELETE /users/:id` - Delete user ✅

### Authentication & Authorization
- `POST /auth/login` - User login ✅
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Token refresh

### Conversation Management
- `GET /conversations` - List conversations
- `GET /conversations/:id` - Get conversation by ID
- `POST /conversations` - Create new conversation
- `PUT /conversations/:id` - Update conversation
- `DELETE /conversations/:id` - Delete conversation

### Message Operations
- `GET /messages` - List messages
- `GET /messages/:id` - Get message by ID
- `POST /messages` - Create new message
- `PUT /messages/:id` - Update message
- `DELETE /messages/:id` - Delete message

## Security & Rate Limiting
All endpoints require proper authentication and implement rate limiting to prevent abuse and ensure system stability.

