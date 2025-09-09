export const conversationTypes = `#graphql
    type Conversation {
        id: ID!
        title: String
        summary: String
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
    type MessageConnection {
        edges: [MessageEdge!]
        pageInfo: PageInfo!
    }
    type MessageEdge {
        cursor: String!
        node: Message!
    }
    type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String!
        endCursor: String!
    }
    type Query {
        conversations: [Conversation!]!
        messages(
            conversationId: ID!,
            first: Int = 20,
            after: String,
            before: String,
            last: Int
        ): MessageConnection!
    }
    type Mutation {
        # startConversation(title: String): Conversation!
        startConversation(content: String!): Message!
        sendMessage(conversationId: ID!, content: String!, aiModel: String): Message!
    }
`