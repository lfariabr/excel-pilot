import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import { formatTimestamp } from "../../utils/dateFormatter";
import Conversation from "../../models/Conversation";
import Message from "../../models/Message";
import { buildCursorQuery, createConnection } from "../../utils/pagination";

export const conversationsQuery = {
    // get all conversations
    // I have defined CONVERSATIONS as the containers/threads - one chat per session
    conversations: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
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

        return conversations_result;
    },
    // get messages using cursor pagination
    // I have defined MESSAGES as the turns inside a conversation
    messages: async (_: any, {conversationId, first = 20, after, before, last }: {
        conversationId: string;
        first?: number;
        after?: string;
        before?: string;
        last?: number;
    }, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }

        // Verify user owns the conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || String(conversation.userId) !== ctx.user.sub) {
            throw new GraphQLError("FORBIDDEN");
        }
        
        // Build cursor-based query:
        const cursorQuery = buildCursorQuery(after);
        const query = {
            conversationId,
            ...cursorQuery
        };

        // Fetch messages (newestfirst and limited by first +1) to check hasNextPage
        const messages = await Message.find(query)
            .sort({ createdAt: -1, _id: -1 }) // newest first
            .limit(first + 1); // +1 to check hasNextPage
            // TODO implement:
            // .select({ conversationId: 1, userId: 1, role: 1, content: 1, aiModel: 1, usage: 1, createdAt: 1 })
            // .lean();
        
        // Check if there are more messages
        const hasNextPage = messages.length > first;
        const hasPreviousPage = !!after;

        if (hasNextPage) {
            messages.pop(); // Remove the extra message
        }

        // Format timestamps in the query result
        const messages_result = messages.map(message => {
            const messageObj = message.toObject() as any;
            return {
                ...messageObj,
                id: messageObj._id.toString(),
                createdAt: formatTimestamp(messageObj.createdAt)
            };
        });

        // Create connection
        const connection = createConnection(messages_result, { first, after, before, last }, messages.length, hasNextPage, hasPreviousPage);
        
        return connection;
    },
}
        