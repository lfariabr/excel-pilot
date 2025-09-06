import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import { formatTimestamp } from "../../utils/dateFormatter";
import Conversation from "../../models/Conversation";
import Message from "../../models/Message";

export const conversationsQuery = {
    // get all conversations
    // I have defined CONVERSATIONS as the containers/threads - one chat per session
    conversations: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
        const conversations = await Conversation.find({ userId: ctx.user.sub }).sort({ updatedAt: -1 });
        
        // Format timestamps in the query result
        const conversations_result = conversations.map(conversation => {
            const convObj = conversation.toObject() as any;
            return {
                ...convObj,
                id: convObj._id.toString(),
                createdAt: formatTimestamp(convObj.createdAt),
                updatedAt: formatTimestamp(convObj.updatedAt),
                lastMessageAt: formatTimestamp(convObj.lastMessageAt)
            };
        });

        return conversations_result;
    },
    // get messages
    // I have defined MESSAGES as the turns inside a conversation
    messages: async (_:any, {conversationId, limit = 20, offset = 0 } : { conversationId: string, limit?: number, offset?: number }, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || String(conversation.userId) !== ctx.user.sub) {
            throw new GraphQLError("FORBIDDEN");
        }
        
        // Get total count for pagination metadata:
        const totalCount = await Message.countDocuments({ conversationId });

        // Previous pagination logic:
        // const messages = await Message.find({ conversationId }).sort({ createdAt: -1 });
        // Get paginated messages:
        const messages = await Message.find({ conversationId })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);

        // Format timestamps in the query result
        const messages_result = messages.map(message => {
            const messageObj = message.toObject() as any;
            return {
                ...messageObj,
                id: messageObj._id.toString(),
                createdAt: formatTimestamp(messageObj.createdAt)
            };
        });

        // Pagination metadata:
        const hasNextPage = offset + limit < totalCount;
        const hasPreviousPage = offset > 0;

        return {
            messages: messages_result,
            totalCount,
            hasNextPage,
            hasPreviousPage
        };
    },
}
        