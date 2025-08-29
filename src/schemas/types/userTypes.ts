export const userTypes = `#graphql
    enum Role {
        admin
        casual
        head
        manager
    }

    type User {
        id: ID!
        name: String!
        role: Role!
        email: String!
        createdAt: String!
        updatedAt: String!
    }

    type AuthPayload {
        accessToken: String!
        user: User!
    }

    input RegisterInput {
        name: String!
        email: String!
        role: Role!
        password: String!
    }

    input LoginInput {
        email: String!
        password: String!
    }

    type Query {
        users: [User!]!
        user(id: ID!): User
        me: User
    }

    type Mutation {
        # CRUD
        createUser(name: String!, email: String!, role: Role!): User!
        updateUser(id: ID!, name: String, email: String, role: Role): User
        deleteUser(id: ID!): User
        
        # Auth
        register(input: RegisterInput!): AuthPayload!
        login(input: LoginInput!): AuthPayload!
        logout: Boolean!
    }
`