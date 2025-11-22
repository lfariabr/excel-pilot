import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";

import Message from "../../models/Message";
import Conversation from "../../models/Conversation";

import { logGraphQL, logOpenAI, logRateLimit, logError } from "../../utils/logger";

import { formatTimestamp } from "../../utils/dateFormatter";
import { TokenEstimator } from "../../utils/tokenEstimator";
import { getSystemPrompt, askOpenAI } from "../../services/openAi";
import { generateConversationTitle, updateConversationTitle } from "../../services/titleGenerator";

import { userRateLimiter } from "../../middleware/rateLimiter";
import { rateLimitConfig } from "../../config/rateLimit.config";
import { rateLimitAnalytics } from "../../middleware/rateLimitAnalytics";

export const conversationsMutation = {
    startConversation: async (_: any, { content }: { content: string }, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }

        try {
            logGraphQL('GraphQL startConversation called', {
                userId: ctx.user.sub,
                contentLength: content.length
            });

            // Add after authentication, before calling askOpenAI:
            const rateLimitResult = await userRateLimiter.checkUserLimit(
                ctx.user.sub, 
                'conversations'
            );
            if (!rateLimitResult.allowed) {
                const userTier = ctx.user.plan || ctx.user.tier || ctx.user.subscription?.tier;
                rateLimitAnalytics.logViolation(
                    ctx.user.sub,
                    'conversations',
                    userTier
                );
                
                logRateLimit('Conversation rate limit exceeded', {
                    userId: ctx.user.sub,
                    limitType: 'conversations',
                    remaining: rateLimitResult.remaining,
                    resetTime: rateLimitResult.resetTime,
                    userTier
                });
                
                throw new GraphQLError(
                `Rate limit exceeded. You can make ${rateLimitConfig.conversations.max} conversations per minute. ` +
                `Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`,
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

        logGraphQL('Conversation created', {
            userId: ctx.user.sub,
            conversationId: (conversation._id as any).toString()
        });

        // Create user message
        const userMessage = await Message.create({
            conversationId: conversation._id,
            userId: ctx.user.sub,
            role: "user",
            content,
        });
        
        // Update token budget
        const estimatedTokens = TokenEstimator.estimateTokens(content, []);
        const budgetResult = await userRateLimiter.checkUserTokenBudget(
            ctx.user.sub, 
            estimatedTokens
        );
        if (!budgetResult.allowed) {
            logRateLimit('Token budget exceeded for conversation', {
                userId: ctx.user.sub,
                conversationId: (conversation._id as any).toString(),
                estimatedTokens,
                remaining: budgetResult.remaining
            });
            
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

        logOpenAI('OpenAI call for new conversation', {
            userId: ctx.user.sub,
            conversationId: (conversation._id as any).toString(),
            estimatedTokens,
            actualTokens: talkToOpenAI.usage?.total_tokens,
            model: talkToOpenAI.model
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
                    input_tokens: talkToOpenAI.usage.input_tokens,
                    output_tokens: talkToOpenAI.usage.output_tokens,
                    total_tokens: talkToOpenAI.usage.total_tokens,
                }
                : undefined,
        });

        // Generate title
        generateConversationTitle(content, talkToOpenAI.text)
            .then(title => updateConversationTitle((conversation._id as any).toString(), title))
            .catch(error => logError('Error generating conversation title', error as Error, {
                conversationId: (conversation._id as any).toString(),
                userId: ctx.user.sub
            }));

        // Bump conversation timestamps
        await Conversation.updateOne({ _id: conversation._id }, { lastMessageAt: new Date() });

        logGraphQL('Conversation started successfully', {
            userId: ctx.user.sub,
            conversationId: (conversation._id as any).toString(),
            tokensUsed: talkToOpenAI.usage?.total_tokens
        });

        const messageObj = AIassistantMessage.toObject() as any;
        return {
            ...messageObj,
            id: messageObj._id.toString(),
            createdAt: formatTimestamp(messageObj.createdAt),
        };
        } catch (error) {
            if (error instanceof GraphQLError) {
                throw error; // Re-throw GraphQL errors (already logged)
            }
            logError('Error starting conversation', error as Error, {
                userId: ctx.user.sub,
                contentLength: content.length
            });
            throw error;
        }
    },
};
