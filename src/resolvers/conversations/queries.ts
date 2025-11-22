import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import { formatTimestamp } from "../../utils/dateFormatter";
import Conversation from "../../models/Conversation";
import { logGraphQL, logError } from "../../utils/logger";

export const conversationsQuery = {
    // get all conversations
    // I have defined CONVERSATIONS as the containers/threads - one chat per session
    conversations: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }

        try {
            logGraphQL('GraphQL conversations query called', {
                userId: ctx.user.sub
            });

            const conversations = await Conversation.find({ userId: ctx.user.sub }).sort({ updatedAt: -1 , _id: -1 });
            
            // Format timestamps in the query result
            const conversations_result = conversations.map(conversation => {
                const convObj = conversation.toObject() as any;
                return {
                    ...convObj,
                    id: convObj._id.toString(),
                    title: convObj.title,
                    summary: convObj.summary,
                    createdAt: formatTimestamp(convObj.createdAt),
                    updatedAt: formatTimestamp(convObj.updatedAt),
                    lastMessageAt: formatTimestamp(convObj.lastMessageAt),
                };
            });

            logGraphQL('GraphQL conversations query completed', {
                userId: ctx.user.sub,
                count: conversations_result.length
            });

            return conversations_result;
        } catch (error) {
            logError('Error fetching conversations', error as Error, {
                userId: ctx.user.sub
            });
            throw error;
        }
    }
}
        