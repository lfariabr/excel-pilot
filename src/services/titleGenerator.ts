import 'dotenv/config';
import { askOpenAI } from '../services/openAi';
import Conversation from '../models/Conversation';
import { logOpenAI, logError } from '../utils/logger';

export async function generateConversationTitle(
    userMessage: string,
    aiResponse: string,
): Promise<string> {
    // 1. Create optimized prompt for title generation
    // 2. Call OpenAI with specific settings for titles
    // 3. Clean and validate the response
    // 4. Return the title

    try {
        // Combine context into a single prompt for title generation
        const titlePrompt = `Based on this conversation, generate a concise 3-6 word title:
        User: ${userMessage}
        Assistant: ${aiResponse.substring(0, 200)}...
        Generate only the title, nothing else.`;

        const response = await askOpenAI({
            userMessage: titlePrompt,
            history: [], // no history needed for title generation
            model: "gpt-4o-mini", // cheapest model
            maxOutputTokens: 20, // short titles
            temperature: 0.3, // less creative, more concise
        });

        // Clean and validate the response
        let title = response.text.trim();

        // Remove quotes if present
        title = title.replace(/^"|"$/g, '');

        // fallback to user message if title is invalid
        if (!title || title.length > 50) {
            return "New Conversation";
        }

        return title;

    } catch (error) {
        logError('Error generating conversation title', error as Error, {
            userMessageLength: userMessage.length,
            aiResponseLength: aiResponse.length
        });
        return "New Conversation";
    }
}

export async function updateConversationTitle(
    conversationId: string,
    title: string,
): Promise<void> {
    // 1. Update the conversation record
    // 2. Handle any errors gracefully
    try {
        await Conversation.findByIdAndUpdate(
            conversationId,
            { title },
            { new: true },
        );
        logOpenAI('Title updated for conversation', {
            conversationId,
            title
        });
    } catch (error) {
        logError('Error updating title for conversation', error as Error, {
            conversationId,
            title
        });
        // we don't throw error because this shouldn't break the chat
    }
}