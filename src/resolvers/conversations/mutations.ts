import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import Conversation from "../../models/Conversation";
import Message from "../../models/Message";
import { askOpenAI } from "../../services/openAi";
import { formatTimestamp } from "../../utils/dateFormatter";
import { userRateLimiter, rateLimitConfig } from "../../middleware/rateLimiter";

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
        // Format timestamps in the mutation result
        const convObj = conversation.toObject() as any;
        await conversation.save();
        return {
            ...convObj,
            id: convObj._id.toString(),
            createdAt: formatTimestamp(convObj.createdAt),
            updatedAt: formatTimestamp(convObj.updatedAt),
            lastMessageAt: formatTimestamp(convObj.lastMessageAt)
        };
    },
    sendMessage: async (_: any, { conversationId, content }: { conversationId: string, content: string }, ctx: any) => {
        // v0.0.6 - Authentication
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }

        // v0.0.8 - Rate Limiting
        const rateLimitResult = await userRateLimiter.checkUserLimit(ctx.user.sub, 'openai');
        if (!rateLimitResult.allowed) {
            throw new GraphQLError(
                `Rate limit exceeded. You can make ${rateLimitConfig.openai.max} OpenAI requests per minute. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`,
            {
                extensions: {
                    code: "RATE_LIMIT_EXCEEDED",
                    remaining: rateLimitResult.remaining,
                    resetTime: rateLimitResult.resetTime,
                }
            }
        );
        }

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

        // v0.0.7 - openAI
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