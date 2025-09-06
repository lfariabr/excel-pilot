/**
 * Rough token estimation for OpenAI requests
 * More accurate than character counting
 */
export class TokenEstimator {

    /**
     * Estimate tokens for a conversation
     * Rule of thumb: ~4 characters per token for English
     * Add overhead for system prompts and formatting
     */
    static estimateTokens(userMessage: string, history: any[]): number {
        // user message tokens
        const userTokens = Math.ceil(userMessage.length / 4);
        
        // history tokens - last 10 messages
        const historyTokens = history.reduce((total, msg) => {
            return total + Math.ceil(msg.content.length / 4);
        }, 0);

        // System prompt overhead (aprox 200 tokens)
        const systemOverhead = 200;

        // Response estimation (assuming similar length to input)
        const responseEstimate = Math.max(100, userTokens);

        // Total tokens
        return userTokens + historyTokens + systemOverhead + responseEstimate;
    }

    /**
     * Get actual tokens from openAI response
     */
    static getActualTokens(openaiResponse: any): number {
        return openaiResponse.usage?.total_tokens || 0;
    }
}