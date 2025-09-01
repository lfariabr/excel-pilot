import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import Conversation from "../../models/Conversation";
import Message from "../../models/Message";

export const conversationsQuery = {
    // get all conversations
    // Conversations are the containers/threads - one chat per session
    conversations: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
        console.log('🔍 GraphQL conversations query called');
        const conversations = await Conversation.find({ userId: ctx.user.sub }).sort({ updatedAt: -1 });
        console.log('📊 Found conversations:', conversations?.length || 0);
        return conversations;
    },
    // get messages
    // Messages are the turns inside a conversation
    messages: async (_:any, {conversationId } : { conversationId: string }, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
        console.log('🔍 GraphQL messages query called');
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || String(conversation.userId) !== ctx.user.sub) {
            throw new GraphQLError("FORBIDDEN");
        }
        const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
        console.log('📊 Found messages:', messages?.length || 0);
        return messages;
    },
}
        