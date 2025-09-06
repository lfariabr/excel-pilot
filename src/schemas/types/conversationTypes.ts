export const conversationTypes = `#graphql
    type Conversation {
        id: ID!
        title: String
        createdAt: String!
        updatedAt: String!
        lastMessageAt: String!
    },
    type Usage {
        input_tokens: Int
        output_tokens: Int
        total_tokens: Int
    }
    type Message {
        id: ID!
        conversationId: ID!
        userId: ID!
        role: String!
        content: String!
        aiModel: String
        usage: Usage
        createdAt: String!
    }
    type PaginatedMessages {
        messages: [Message!]!
        totalCount: Int!
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
    }
    type Query {
        conversations: [Conversation!]!
        messages(conversationId: ID!, limit: Int = 20, offset: Int = 0): PaginatedMessages!
    }
    type Mutation {
        startConversation(title: String): Conversation!
        sendMessage(conversationId: ID!, content: String!, aiModel: String): Message!
    }
`