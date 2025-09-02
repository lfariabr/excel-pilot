/**
 * Utility functions for date formatting in GraphQL responses
 */

/**
 * Converts MongoDB timestamp (number or Date) to ISO string
 * @param timestamp - MongoDB timestamp (can be number or Date object)
 * @returns ISO string format (e.g., "2025-09-03T06:31:17.000Z")
 */
export const formatTimestamp = (timestamp: number | Date | string): string => {
    if (!timestamp) return new Date().toISOString();
    
    // Handle different timestamp formats
    if (typeof timestamp === 'number') {
        return new Date(timestamp).toISOString();
    }
    
    if (timestamp instanceof Date) {
        return timestamp.toISOString();
    }
    
    // Handle string timestamps
    return new Date(timestamp).toISOString();
};

/**
 * Converts MongoDB timestamp to human-readable format
 * @param timestamp - MongoDB timestamp
 * @returns Human readable format (e.g., "Sep 3, 2025, 6:31 AM")
 */
export const formatTimestampHuman = (timestamp: number | Date | string): string => {
    if (!timestamp) return new Date().toLocaleString();
    
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};
