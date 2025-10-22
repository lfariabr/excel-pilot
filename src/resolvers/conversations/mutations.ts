import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import Message from "../../models/Message";
import Conversation from "../../models/Conversation";
import { formatTimestamp } from "../../utils/dateFormatter";
import { TokenEstimator } from "../../utils/tokenEstimator";
import { getSystemPrompt, askOpenAI } from "../../services/openAi";
import { userRateLimiter } from "../../middleware/rateLimiter";
import { generateConversationTitle, updateConversationTitle } from "../../services/titleGenerator";
import { rateLimitConfig } from "../../config/rateLimit.config";

export const conversationsMutation = {
    startConversation: async (_: any, { content }: { content: string }, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }

        // Add after authentication, before calling askOpenAI:
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

        // Create new conversation (without title initially)
        const conversation = new Conversation({
            userId: ctx.user.sub,
            systemPrompt: getSystemPrompt(),
            lastMessageAt: new Date(),
        });
        await conversation.save();

        // Create user message
        const userMessage = await Message.create({
            conversationId: conversation._id,
            userId: ctx.user.sub,
            role: "user",
            content,
        });
        
        // Update token budget
        const estimatedTokens = TokenEstimator.estimateTokens(content, []);
        const budgetResult = await userRateLimiter.checkUserTokenBudget(ctx.user.sub, estimatedTokens);
        if (!budgetResult.allowed) {
            throw new GraphQLError(
                `Daily token budget exceeded. Remaining: ${budgetResult.remaining} tokens. Resets in ${Math.ceil((budgetResult.resetTime - Date.now()) / (1000 * 60 * 60))} hours.`,
                {
                    extensions: {
                        code: "TOKEN_BUDGET_EXCEEDED",
                        remaining: budgetResult.remaining,
                        resetTime: budgetResult.resetTime,
                    }
                }
            );
        }
        
        // Call openAI (No history for first message)
        const talkToOpenAI = await askOpenAI({
            userMessage: content,
            history: [],
        });

        // Persist assistant message
        const AIassistantMessage = await Message.create({
            conversationId: conversation._id,
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

        // Generate title
        generateConversationTitle(content, talkToOpenAI.text)
            .then(title => updateConversationTitle((conversation._id as any).toString(), title))
            .catch(error => console.error("Error generating conversation title:", error));

        // Bump conversation timestamps
        await Conversation.updateOne({ _id: conversation._id }, { lastMessageAt: new Date() });

        const messageObj = AIassistantMessage.toObject() as any;
        return {
            ...messageObj,
            id: messageObj._id.toString(),
            createdAt: formatTimestamp(messageObj.createdAt),
        }
    },
};