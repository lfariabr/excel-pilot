import { usersQuery } from "./users/queries";
import { usersMutation } from "./users/mutations";

export const resolvers = {
    User: {
        id: (user: any) => user._id.toString(),
    },
    Query: {
        ...usersQuery,
    },
    Mutation: {
        ...usersMutation,
    },
};