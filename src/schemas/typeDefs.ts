import { userTypes } from "./types/userTypes";

export const typeDefs = `#graphql
    ${userTypes}

    type Query {
        # Test query
        hello: String

        # User queries
        users: [User!]!
        user(id: ID!): User
    }

    type Mutation {
        createUser(name: String!, email: String!, role: Role!): User
        updateUser(id: ID!, name: String, email: String, role: Role): User
        deleteUser(id: ID!): User
    }
`;