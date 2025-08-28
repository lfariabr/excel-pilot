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

    type Query {
        users: [User]
        user(id: ID!): User
    }

    type Mutation {
        createUser(name: String!, email: String!, role: Role!): User
        updateUser(id: ID!, name: String, email: String, role: Role): User
        deleteUser(id: ID!): User
    }
`