import { Types } from 'mongoose';

export interface PaginationArgs {
    first?: number;
    after?: string;
    before?: string;
    last?: number;
}

export interface PageInfo {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
}

export interface Connection<T> {
    edges: Array<{
        node: T;
        cursor: string;
    }>;
    pageInfo: PageInfo;
}

/**
 * Create cursor from MongoDB ObjectId
 */
export function createCursor(id: string | Types.ObjectId): string {
    return Buffer.from(id.toString()).toString('base64');
}

/**
 * Parse cursor to MongoDB ObjectId
 */
export function parseCursor(cursor: string): Types.ObjectId {
    try {
        const id = Buffer.from(cursor, 'base64').toString('ascii');
        return new Types.ObjectId(id);
    } catch (error) {
        throw new Error('Invalid cursor format');
    }
}

/**
 * Build MongoDB query for cursor-based pagination
 */
export function buildCursorQuery(after?: string) {
    if (!after) return {};

    const afterId = parseCursor(after);
    // For newest-first order, we want messages older than the cursor
    return { _id: { $lt: afterId } };
}

/**
 * Create connection from MongoDB results
 */
export function createConnection<T extends { _id: any }>(
    nodes: T[],
    args: PaginationArgs,
    totalCount?: number,
    hasNextPage?: boolean,
    hasPreviousPage?: boolean
): Connection<T> {
    const edges = nodes.map(node => ({
        node,
        cursor: createCursor(node._id),
    }));

    const pageInfo: PageInfo = {
        hasNextPage: hasNextPage ?? (nodes.length === args.first),
        hasPreviousPage: hasPreviousPage ?? !!args.after,
        startCursor: edges.length > 0 ? edges[0].cursor : undefined,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
    };
    
    return {
        edges,
        pageInfo,
    };
}