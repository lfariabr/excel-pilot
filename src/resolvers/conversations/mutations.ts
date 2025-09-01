import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import Conversation from "../../models/Conversation";
import Message from "../../models/Message";
import { askOpenAI } from "../../services/openAi";

export const conversationsMutation = {
    startConversation: async (_: any, { title }: { title: string }, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
        const conversation = new Conversation({
            userId: ctx.user.sub,
            title,
            systemPrompt: "You are Excel's BM Concierge Personal Assistant.",
            lastMessageAt: new Date(),
        });
        await conversation.save();
        return conversation;
    },
    sendMessage: async (_: any, { conversationId, content }: { conversationId: string, content: string }, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }
        console.log("conversationId", conversationId);
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || String(conversation.userId) !== ctx.user.sub) {
            throw new GraphQLError("FORBIDDEN");
        }
        const userMessage = await Message.create({
            conversationId,
            userId: ctx.user.sub,
            role: "user",
            content,
        });

        // fetch last 10 messages
        const historyDocs = await Message.find({ conversationId })
            .sort({ createdAt: -1 })
            .limit(10);
        const history = historyDocs.map((m) => ({
            role: m.role as "user"|"assistant"|"system",
            content: m.content,
        }));

        // call openAI
        const talkToOpenAI = await askOpenAI({
            history,
            userMessage: content,
        });

        // persist assistant message
        const AIassistantMessage = await Message.create({
            conversationId,
            userId: ctx.user.sub,
            role: "assistant",
            content: talkToOpenAI.text,
            aiModel: talkToOpenAI.model,
            usage: talkToOpenAI.usage
                ? {
                    inputTokens: talkToOpenAI.usage.input_tokens,
                    outputTokens: talkToOpenAI.usage.output_tokens,
                    totalTokens: talkToOpenAI.usage.total_tokens,
                }
                : undefined,
        });

        // bump conversation timestamps
        await Conversation.updateOne({ _id: conversationId }, { lastMessageAt: new Date() });

        return AIassistantMessage;
    },
};