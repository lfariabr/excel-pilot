import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";
import Message from "../../models/Message";
import Conversation from "../../models/Conversation";
import { formatTimestamp } from "../../utils/dateFormatter";
import { TokenEstimator } from "../../utils/tokenEstimator";
import { getSystemPrompt, askOpenAI } from "../../services/openAi";
import { userRateLimiter, rateLimitConfig } from "../../middleware/rateLimiter";
import { generateConversationTitle, updateConversationTitle } from "../../services/titleGenerator";
import { generateConversationSummary, updateConversationSummary } from "../../services/summaryGenerator";

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

        // Estimate token usage before calling OpenAI
        const estimatedTokens = TokenEstimator.estimateTokens(content, history);
        console.log(`Estimated tokens: ${estimatedTokens}`);
        const budgetResult = await userRateLimiter.checkUserTokenBudget(ctx.user.sub, estimatedTokens);
        console.log(`Budget check:`, {
            allowed: budgetResult.allowed,
            remaining: budgetResult.remaining,
            resetIn: Math.ceil((budgetResult.resetTime - Date.now()) / (1000 * 60 * 60)) + 'h'
        });
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

        // v0.0.7 - openAI
        // call openAI
        const talkToOpenAI = await askOpenAI({
            history,
            userMessage: content,
        });

        // update token budget
        const actualTokens = TokenEstimator.getActualTokens(talkToOpenAI);
        const tokenDifference = actualTokens - estimatedTokens;

        if (tokenDifference > 0) {
            // means we underestimated and need to add tokens
            await userRateLimiter.checkUserTokenBudget(ctx.user.sub, tokenDifference);
        }

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

        // generate title
        if (!conversation.title) {
            const messageCount = await Message.countDocuments({ conversationId });
            if (messageCount === 2) { // 1 user message + 1 AI message = first conversation
                // generatle the title in background (don't wait and don't slow down the response)
                generateConversationTitle(content, talkToOpenAI.text)
                    .then(title => updateConversationTitle(conversationId, title))
                    .catch(error => console.error("Error generating conversation title:", error));
            }
        }
        // generate summary (separate from title logic)
        const messageCount = await Message.countDocuments({ conversationId });
        console.log("Message count:", messageCount);
        if (messageCount >= 10 && (messageCount - 10) % 5 === 0) {
            // Generate summary at 10, 15, 20, 25... messages
            generateConversationSummary(history)
                .then(summary => updateConversationSummary(conversationId, summary))
                .catch(error => console.error("Error generating conversation summary:", error));
        }

        // bump conversation timestamps
        await Conversation.updateOne({ _id: conversationId }, { lastMessageAt: new Date() });

        return AIassistantMessage;
    },
};