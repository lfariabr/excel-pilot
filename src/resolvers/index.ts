import { usersQuery } from "./users/queries";
import { usersMutation } from "./users/mutations";
import { authQueries } from "./auth/queries";
import { authMutations } from "./auth/mutations";
import { conversationsQuery } from "./conversations/queries";
import { conversationsMutation } from "./conversations/mutations";
import { messagesQuery } from "./messages/queries";
import { messagesMutation } from "./messages/mutations";

export const resolvers = {
    User: {
        id: (user: any) => user._id.toString(),
    },
    Query: {
        ...usersQuery,
        ...authQueries,
        ...conversationsQuery,
        ...messagesQuery,
    },
    Mutation: {
        ...usersMutation,
        ...authMutations,
        ...conversationsMutation,
        ...messagesMutation,
    },
};