export const rateLimitConfig = {
    messages: { 
        windowMs: 60 * 1000, 
        max: 30, // 30 requests per minute (window)
    }, 
    conversations: { 
        windowMs: 60 * 1000, 
        max: 5, // 5 requests per minute (window)
    },
};