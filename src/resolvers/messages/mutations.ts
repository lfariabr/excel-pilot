import { GraphQLError } from "graphql";
import { requireAuth } from "../../utils/guards";

import Message from "../../models/Message";
import Conversation from "../../models/Conversation";

import { logGraphQL, logOpenAI, logRateLimit, logError } from "../../utils/logger";

import { TokenEstimator } from "../../utils/tokenEstimator";
import { userRateLimiter } from "../../middleware/rateLimiter";
import { rateLimitConfig } from "../../config/rateLimit.config";
import { rateLimitAnalytics } from "../../middleware/rateLimitAnalytics";

import { askOpenAI } from "../../services/openAi";
import { generateConversationTitle, updateConversationTitle } from "../../services/titleGenerator";
import { generateConversationSummary, updateConversationSummary } from "../../services/summaryGenerator";

export const messagesMutation = {
    sendMessage: async (_: any, { conversationId, content }: { conversationId: string, content: string }, ctx: any) => {
        // v0.0.6 - Authentication
        requireAuth(ctx);
        if (!ctx.user) {
            throw new GraphQLError("UNAUTHENTICATED");
        }

        try {
            logGraphQL('GraphQL sendMessage called', {
                userId: ctx.user.sub,
                conversationId,
                contentLength: content.length
            });

            // v0.0.8 - Rate Limiting
            const rateLimitResult = await userRateLimiter.checkUserLimit(
                ctx.user.sub, 
                'messages'
            );
            if (!rateLimitResult.allowed) {
                const userTier = ctx.user.plan || ctx.user.tier || ctx.user.subscription?.tier;
                rateLimitAnalytics.logViolation(
                    ctx.user.sub,
                    'messages',
                    userTier
                );
                
                logRateLimit('Message rate limit exceeded', {
                    userId: ctx.user.sub,
                    conversationId,
                    limitType: 'messages',
                    remaining: rateLimitResult.remaining,
                    resetTime: rateLimitResult.resetTime,
                    userTier
                });
                
                throw new GraphQLError(
                    `Rate limit exceeded. You can make ${rateLimitConfig.messages.max} messages per minute. ` +
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

            const conversation = await Conversation.findById(conversationId);
            if (!conversation || String(conversation.userId) !== ctx.user.sub) {
                logError('Forbidden message access attempt', new Error('User does not own conversation'), {
                    userId: ctx.user.sub,
                    conversationId,
                    conversationOwner: conversation?.userId
                });
                throw new GraphQLError("Forbidden", {
                    extensions: {
                        code: "FORBIDDEN"
                    }
                });
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
            
            logRateLimit('Token budget check', {
                userId: ctx.user.sub,
                conversationId,
                estimatedTokens,
                historyLength: history.length
            });
            
            const budgetResult = await userRateLimiter.checkUserTokenBudget(ctx.user.sub, estimatedTokens);
            
            logRateLimit('Token budget result', {
                userId: ctx.user.sub,
                conversationId,
                allowed: budgetResult.allowed,
                remaining: budgetResult.remaining,
                resetIn: Math.ceil((budgetResult.resetTime - Date.now()) / (1000 * 60 * 60)) + 'h'
            });
            
            if (!budgetResult.allowed) {
                logRateLimit('Token budget exceeded for message', {
                    userId: ctx.user.sub,
                    conversationId,
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

            // v0.0.7 - openAI
            // call openAI
            const talkToOpenAI = await askOpenAI({
                history,
                userMessage: content,
            });

            // update token budget
            const actualTokens = TokenEstimator.getActualTokens(talkToOpenAI);
            const tokenDifference = actualTokens - estimatedTokens;

            logOpenAI('OpenAI call for message', {
                userId: ctx.user.sub,
                conversationId,
                estimatedTokens,
                actualTokens,
                tokenDifference,
                model: talkToOpenAI.model,
                inputTokens: talkToOpenAI.usage?.input_tokens,
                outputTokens: talkToOpenAI.usage?.output_tokens
            });

            if (tokenDifference > 0) {
                // means we underestimated and need to add tokens
                logRateLimit('Adjusting token budget for underestimation', {
                    userId: ctx.user.sub,
                    conversationId,
                    tokenDifference,
                    estimated: estimatedTokens,
                    actual: actualTokens
                });
                
                // Check if adjustment would exceed budget
                const adjustmentResult = await userRateLimiter.checkUserTokenBudget(
                    ctx.user.sub, 
                    tokenDifference
                );
                
                if (!adjustmentResult.allowed) {
                    // Log budget breach (response already generated, can't undo)
                    logRateLimit('Token budget exceeded during post-call adjustment', {
                        userId: ctx.user.sub,
                        conversationId,
                        tokenDifference,
                        estimated: estimatedTokens,
                        actual: actualTokens,
                        remaining: adjustmentResult.remaining,
                        wouldNeedTotal: estimatedTokens + tokenDifference
                    });
                    // Note: We don't throw here because the AI response was already generated
                    // and the user received value. Budget is debited regardless.
                }
            } else if (tokenDifference < 0) {
                // Overestimated - user was conservatively charged, which is acceptable
                logRateLimit('Token budget overestimation (user conservatively charged)', {
                    userId: ctx.user.sub,
                    conversationId,
                    tokenDifference: Math.abs(tokenDifference),
                    estimated: estimatedTokens,
                    actual: actualTokens
                });
                // Note: We don't refund overestimations as it provides a safety buffer
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
                        input_tokens: talkToOpenAI.usage.input_tokens,
                        output_tokens: talkToOpenAI.usage.output_tokens,
                        total_tokens: talkToOpenAI.usage.total_tokens,
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
                        .catch(error => logError('Error generating conversation title', error as Error, {
                            conversationId,
                            userId: ctx.user.sub
                        }));
                }
            }
            // generate summary (separate from title logic)
            const messageCount = await Message.countDocuments({ conversationId });
            
            logGraphQL('Message count check for summary generation', {
                userId: ctx.user.sub,
                conversationId,
                messageCount,
                willGenerateSummary: messageCount >= 10 && (messageCount - 10) % 5 === 0
            });
            
            if (messageCount >= 10 && (messageCount - 10) % 5 === 0) {
                // Generate summary at 10, 15, 20, 25... messages
                generateConversationSummary(history)
                    .then(summary => updateConversationSummary(conversationId, summary))
                    .catch(error => logError('Error generating conversation summary', error as Error, {
                        conversationId,
                        userId: ctx.user.sub,
                        messageCount
                    }));
            }

            // bump conversation timestamps
            await Conversation.updateOne({ _id: conversationId }, { lastMessageAt: new Date() });

            logGraphQL('Message sent successfully', {
                userId: ctx.user.sub,
                conversationId,
                tokensUsed: actualTokens,
                messageCount
            });

            return AIassistantMessage;
        } catch (error) {
            if (error instanceof GraphQLError) {
                throw error; // Re-throw GraphQL errors (already logged)
            }
            logError('Error sending message', error as Error, {
                userId: ctx.user.sub,
                conversationId,
                contentLength: content.length
            });
            throw error;
        }
    },
};