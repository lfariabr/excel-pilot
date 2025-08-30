import { usersQuery } from "./users/queries";
import { usersMutation } from "./users/mutations";
import { authResolvers } from "./auth/auth";

export const resolvers = {
    User: {
        id: (user: any) => user._id.toString(),
    },
    Query: {
        ...usersQuery,
        ...authResolvers.Query,
    },
    Mutation: {
        ...usersMutation,
        ...authResolvers.Mutation,
    },
};