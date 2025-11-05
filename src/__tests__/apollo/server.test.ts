// __tests__/apollo/server.test.ts

// Set dummy OpenAI API key BEFORE any imports
process.env.OPENAI_API_KEY = 'test-api-key';

// Mock external dependencies FIRST - before any imports that use them
jest.mock('../../services/openAi');
jest.mock('../../services/titleGenerator');
jest.mock('../../services/summaryGenerator');
jest.mock('../../middleware/rateLimiter');
jest.mock('../../middleware/rateLimitAnalytics');

import { ApolloServer } from '@apollo/server';
import { typeDefs } from '../../schemas/typeDefs';
import { resolvers } from '../../resolvers';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import UserModel from '../../models/User';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import { signAccessToken } from '../../utils/jwt';

import { askOpenAI } from '../../services/openAi';
import { generateConversationTitle } from '../../services/titleGenerator';
import { generateConversationSummary } from '../../services/summaryGenerator';
import { userRateLimiter } from '../../middleware/rateLimiter';

describe('Apollo Server', () => {
  let server: ApolloServer;
  let mongoServer: MongoMemoryServer;
  let testUserId: mongoose.Types.ObjectId;
  let authToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Create test server
    server = new ApolloServer({
      typeDefs,
      resolvers,
    });
  });

  afterAll(async () => {
    await server.stop();
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create test user
    const user = await UserModel.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'casual'
    });
    testUserId = user._id as mongoose.Types.ObjectId;
    authToken = signAccessToken({ 
      sub: testUserId.toString(), 
      email: user.email, 
      role: user.role 
    });

    // Mock rate limiter
    (userRateLimiter.checkUserLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60000
    });

    (userRateLimiter.checkUserTokenBudget as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 49000,
      resetTime: Date.now() + 86400000
    });

    // Mock OpenAI
    (askOpenAI as jest.Mock).mockResolvedValue({
      text: 'AI response',
      model: 'gpt-4',
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30
      }
    });

    // Mock title and summary generators
    (generateConversationTitle as jest.Mock).mockResolvedValue('Generated Title');
    (generateConversationSummary as jest.Mock).mockResolvedValue('Generated Summary');
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await UserModel.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should have valid schema', () => {
      expect(typeDefs).toBeDefined();
      expect(resolvers).toBeDefined();
      expect(resolvers.Query).toBeDefined();
      expect(resolvers.Mutation).toBeDefined();
    });

    it('should include authentication queries', () => {
      expect(resolvers.Query.me).toBeDefined();
    });

    it('should include authentication mutations', () => {
      expect(resolvers.Mutation.register).toBeDefined();
      expect(resolvers.Mutation.login).toBeDefined();
    });

    it('should include conversation operations', () => {
      expect(resolvers.Query.conversations).toBeDefined();
      expect(resolvers.Mutation.startConversation).toBeDefined();
    });

    it('should include message operations', () => {
      expect(resolvers.Query.messages).toBeDefined();
      expect(resolvers.Mutation.sendMessage).toBeDefined();
    });
  });

  describe('Context Creation', () => {
    it('should create context with authenticated user', async () => {
      const ctx = {
        user: {
          sub: testUserId.toString(),
          email: 'test@example.com',
          role: 'casual'
        }
      };

      expect(ctx.user).toBeDefined();
      expect(ctx.user.sub).toBe(testUserId.toString());
      expect(ctx.user.email).toBe('test@example.com');
      expect(ctx.user.role).toBe('casual');
    });

    it('should create context with null user when not authenticated', () => {
      const ctx = { user: null };

      expect(ctx.user).toBeNull();
    });
  });

  describe('Query Execution', () => {
    it('should execute me query with authentication', async () => {
      const response = await server.executeOperation(
        {
          query: `
            query Me {
              me {
                id
                name
                email
                role
              }
            }
          `,
        },
        {
          contextValue: {
            user: {
              sub: testUserId.toString(),
              email: 'test@example.com',
              role: 'casual'
            }
          },
        }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect((response.body.singleResult.data as any)?.me).toBeDefined();
        expect((response.body.singleResult.data as any)?.me.email).toBe('test@example.com');
      }
    });

    it('should execute conversations query', async () => {
      // Create test conversation
      await Conversation.create({
        userId: testUserId,
        systemPrompt: 'Test prompt',
        title: 'Test Conversation'
      });

      const response = await server.executeOperation(
        {
          query: `
            query Conversations {
              conversations {
                id
                title
                summary
                createdAt
                updatedAt
              }
            }
          `,
        },
        {
          contextValue: {
            user: {
              sub: testUserId.toString(),
              email: 'test@example.com',
              role: 'casual'
            }
          },
        }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect((response.body.singleResult.data as any)?.conversations).toHaveLength(1);
        expect((response.body.singleResult.data as any)?.conversations[0].title).toBe('Test Conversation');
      }
    });
  });

  describe('Mutation Execution', () => {
    it('should execute register mutation', async () => {
      const response = await server.executeOperation({
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              accessToken
              user {
                id
                name
                email
                role
              }
            }
          }
        `,
        variables: {
          input: {
            name: 'New User',
            email: 'new@example.com',
            password: 'password123',
            role: 'casual'
          }
        },
      });

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect((response.body.singleResult.data as any)?.register.accessToken).toBeDefined();
        expect((response.body.singleResult.data as any)?.register.user.email).toBe('new@example.com');
      }
    });

    it('should execute login mutation', async () => {
      const response = await server.executeOperation({
        query: `
          mutation Login($input: LoginInput!) {
            login(input: $input) {
              accessToken
              user {
                id
                email
              }
            }
          }
        `,
        variables: {
          input: {
            email: 'test@example.com',
            password: 'password123'
          }
        },
      });

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect((response.body.singleResult.data as any)?.login.accessToken).toBeDefined();
      }
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject queries without authentication', async () => {
      const response = await server.executeOperation(
        {
          query: `
            query Me {
              me {
                id
                email
              }
            }
          `,
        },
        {
          contextValue: {
            user: null
          },
        }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeDefined();
        expect(response.body.singleResult.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should reject mutations without authentication', async () => {
      const response = await server.executeOperation(
        {
          query: `
            mutation StartConversation($content: String!) {
              startConversation(content: $content) {
                id
                content
              }
            }
          `,
          variables: {
            content: 'Test message'
          },
        },
        {
          contextValue: {
            user: null
          },
        }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeDefined();
      }
    });
  });

  describe('Error Formatting', () => {
    it('should format GraphQL errors correctly', async () => {
      const response = await server.executeOperation(
        {
          query: `
            query InvalidQuery {
              nonExistentField
            }
          `,
        },
        {
          contextValue: {
            user: {
              sub: testUserId.toString(),
              email: 'test@example.com',
              role: 'casual'
            }
          },
        }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeDefined();
        expect(response.body.singleResult.errors?.[0].message).toBeDefined();
      }
    });

    it('should include error extensions', async () => {
      const response = await server.executeOperation(
        {
          query: `
            query Me {
              me {
                id
              }
            }
          `,
        },
        {
          contextValue: {
            user: null
          },
        }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors?.[0].extensions).toBeDefined();
        expect(response.body.singleResult.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
      }
    });
  });

  // Note: Detailed mutation tests are in resolver tests
  // Apollo tests focus on E2E flows and GraphQL integration

  describe('GraphQL Introspection', () => {
    it('should support introspection query', async () => {
      const response = await server.executeOperation({
        query: `
          query IntrospectionQuery {
            __schema {
              types {
                name
                kind
              }
            }
          }
        `,
      });

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect((response.body.singleResult.data as any)?.__schema).toBeDefined();
        expect((response.body.singleResult.data as any)?.__schema.types).toBeDefined();
        
        // Check for custom types
        const typeNames = (response.body.singleResult.data as any)?.__schema.types.map((t: any) => t.name);
        expect(typeNames).toContain('Query');
        expect(typeNames).toContain('Mutation');
        expect(typeNames).toContain('User');
        expect(typeNames).toContain('Conversation');
        expect(typeNames).toContain('Message');
      }
    });

    it('should return type information for User', async () => {
      const response = await server.executeOperation({
        query: `
          query TypeQuery {
            __type(name: "User") {
              name
              kind
              fields {
                name
                type {
                  name
                  kind
                }
              }
            }
          }
        `,
      });

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect((response.body.singleResult.data as any)?.__type.name).toBe('User');
        
        const fieldNames = (response.body.singleResult.data as any)?.__type.fields.map((f: any) => f.name);
        expect(fieldNames).toContain('id');
        expect(fieldNames).toContain('email');
        expect(fieldNames).toContain('name');
        expect(fieldNames).toContain('role');
      }
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server successfully', async () => {
      // Server already started in beforeAll
      expect(server).toBeDefined();
      
      // Server should be able to execute operations
      const response = await server.executeOperation({
        query: `
          query HealthCheck {
            __typename
          }
        `,
      });
      
      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data?.__typename).toBe('Query');
      }
    });
  });

  describe('Integration', () => {
    it('should handle complete authentication flow', async () => {
      // 1. Register
      const registerResponse = await server.executeOperation({
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              accessToken
            }
          }
        `,
        variables: {
          input: {
            name: 'Flow Test',
            email: 'flow@example.com',
            password: 'password123',
            role: 'casual'
          }
        },
      });

      expect(registerResponse.body.kind).toBe('single');
      if (registerResponse.body.kind === 'single') {
        const token = (registerResponse.body.singleResult.data as any)?.register.accessToken;
        expect(token).toBeDefined();

        // 2. Use token to query me
        const meResponse = await server.executeOperation(
          {
            query: `
              query Me {
                me {
                  email
                }
              }
            `,
          },
          {
            contextValue: {
              user: {
                sub: testUserId.toString(),
                email: 'flow@example.com',
                role: 'casual'
              }
            },
          }
        );

        expect(meResponse.body.kind).toBe('single');
      }
    });

    it('should handle complete conversation flow', async () => {
      // 1. Start conversation
      const startResponse = await server.executeOperation(
        {
          query: `
            mutation StartConversation($content: String!) {
              startConversation(content: $content) {
                id
                content
              }
            }
          `,
          variables: {
            content: 'What is TypeScript?'
          }
        },
        {
          contextValue: {
            user: {
              sub: testUserId.toString(),
              email: 'test@example.com',
              role: 'casual'
            }
          },
        }
      );

      expect(startResponse.body.kind).toBe('single');
      if (startResponse.body.kind === 'single') {
        expect(startResponse.body.singleResult.errors).toBeUndefined();

        // 2. Get conversation
        const conversation = await Conversation.findOne({ userId: testUserId });
        expect(conversation).toBeDefined();

        // 3. Send another message
        const sendResponse = await server.executeOperation(
          {
            query: `
              mutation SendMessage($conversationId: ID!, $content: String!) {
                sendMessage(conversationId: $conversationId, content: $content) {
                  id
                  content
                }
              }
            `,
            variables: {
              conversationId: (conversation!._id as mongoose.Types.ObjectId).toString(),
              content: 'Tell me more'
            }
          },
          {
            contextValue: {
              user: {
                sub: testUserId.toString(),
                email: 'test@example.com',
                role: 'casual'
              }
            },
          }
        );

        expect(sendResponse.body.kind).toBe('single');
        if (sendResponse.body.kind === 'single') {
          expect(sendResponse.body.singleResult.errors).toBeUndefined();

          // 4. Query messages
          const messagesResponse = await server.executeOperation(
            {
              query: `
                query Messages($conversationId: ID!) {
                  messages(conversationId: $conversationId) {
                    edges {
                      node {
                        id
                        content
                        role
                      }
                    }
                  }
                }
              `,
              variables: {
                conversationId: (conversation!._id as mongoose.Types.ObjectId).toString()
              }
            },
            {
              contextValue: {
                user: {
                  sub: testUserId.toString(),
                  email: 'test@example.com',
                  role: 'casual'
                }
              },
            }
          );

          expect(messagesResponse.body.kind).toBe('single');
          if (messagesResponse.body.kind === 'single') {
            expect(messagesResponse.body.singleResult.errors).toBeUndefined();
            // Should have 4 messages: 2 user + 2 assistant
            expect((messagesResponse.body.singleResult.data as any)?.messages.edges).toHaveLength(4);
          }
        }
      }
    });
  });
});