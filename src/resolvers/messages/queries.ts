import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import { formatTimestamp } from "../../utils/dateFormatter";
import Conversation from "../../models/Conversation";
import Message from "../../models/Message";
import { buildCursorQuery, createConnection } from "../../utils/pagination";
import { logGraphQL, logError } from "../../utils/logger";

export const messagesQuery = {
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

        try {
            logGraphQL('GraphQL messages query called', {
                userId: ctx.user.sub,
                conversationId,
                first,
                after,
                before,
                last
            });

            // Verify user owns the conversation
            const conversation = await Conversation.findById(conversationId);
            if (!conversation || String(conversation.userId) !== ctx.user.sub) {
                logError('Forbidden messages access attempt', new Error('User does not own conversation'), {
                    userId: ctx.user.sub,
                    conversationId,
                    conversationOwner: conversation?.userId
                });
                throw new GraphQLError("Forbidden", {
                    extensions: { code: "FORBIDDEN" }
                });
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
            
            logGraphQL('GraphQL messages query completed', {
                userId: ctx.user.sub,
                conversationId,
                messagesReturned: messages_result.length,
                hasNextPage,
                hasPreviousPage
            });
            
            return connection;
        } catch (error) {
            if (error instanceof GraphQLError) {
                throw error; // Re-throw GraphQL errors (already logged)
            }
            logError('Error fetching messages', error as Error, {
                userId: ctx.user.sub,
                conversationId,
                first,
                after
            });
            throw error;
        }
    },
}
        