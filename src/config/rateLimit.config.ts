export const rateLimitConfig = {
    openai: { 
        windowMs: 60 * 1000,
        max: 10, // 10 requests per minute (window)
    }, 
    messages: { 
        windowMs: 60 * 1000, 
        max: 30, // 30 requests per minute (window)
    }, 
    conversations: { 
        windowMs: 60 * 1000, 
        max: 5, // 5 requests per minute (window)
    },
};