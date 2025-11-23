import 'dotenv/config';
import { askOpenAI } from '../services/openAi';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { logOpenAI, logError } from '../utils/logger';

export async function generateConversationSummary(
    messages: any,
): Promise<string> {
    // Validate inputs before making API call
    if (!messages || (typeof messages === 'string' && !messages.trim()) || (Array.isArray(messages) && messages.length === 0)) {
        return "No summary available";
    }

    try {
        // Combine messages into a single prompt for summary generation
        const summaryPrompt = `Summarize this conversation in 2-3 sentences focusing on:
        1. Main topics discussed
        2. User's key questions/goals
        3. Important outcomes or decisions

        Conversation:
        ${messages}

        Summary (50-100 words):`;

        const response = await askOpenAI({
            userMessage: summaryPrompt,
            history: messages, // no history needed for summary generation
            model: "gpt-4o-mini", // cheapest model
            maxOutputTokens: 200, // short summaries
            temperature: 0.3, // less creative, more concise
        });

        // Clean and validate the response
        let summary = response.text.trim();

        // Remove quotes if present
        summary = summary.replace(/^"|"$/g, '');

        // fallback to user message if summary is invalid
        if (!summary || summary.length > 500) {
            return "No summary available";
        }

        return summary;
    } catch (error) {
        logError('Error generating conversation summary', error as Error, {
            messagesCount: messages?.length || 0
        });
        return "Error generating summary";
    }
}

export async function updateConversationSummary(
    conversationId: string,
    summary: string,
): Promise<void> {
    try {
        await Conversation.findByIdAndUpdate(
            conversationId,
            { summary },
            { new: true },
        );
        logOpenAI('Summary updated for conversation', {
            conversationId,
            summaryLength: summary.length
        });
    } catch (error) {
        logError('Error updating summary for conversation', error as Error, {
            conversationId,
            summaryLength: summary.length
        });
        // we don't throw error because this shouldn't break the chat
    }
}
