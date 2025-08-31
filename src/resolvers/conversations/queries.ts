import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import Conversation from "../../models/Conversation";

import Message from "../../models/Message";
import { askOpenAI } from "../../services/openAi";

export const conversationsQuery = {
    // get all conversations
    conversations: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
        const conversations = await Conversation.find({ userId: ctx.user.sub }).sort({ updatedAt: -1 });
        return conversations;
    },
    // get messages
    messages: async (_:any, {conversationId } : { conversationId: string }, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || String(conversation.userId) !== ctx.user.sub) {
            throw new GraphQLError("FORBIDDEN");
        }
        const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
        return messages;
    },
}
        