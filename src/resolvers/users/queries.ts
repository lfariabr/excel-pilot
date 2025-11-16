import UserModel from "../../models/User";
import { requireAuth } from "../../utils/guards";
import { logGraphQL, logError } from "../../utils/logger";

export const usersQuery = {
    // get all users
    users: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        try {

        // testing
        // curl -X POST http://localhost:4000/graphql \
        //   -H "Content-Type: application/json" \
        //   -d '{"query":"{ users { id name email role } }"}'
            logGraphQL('GraphQL users query called', { userId: ctx.user?.sub });
            const users = await UserModel.find().lean();
            logGraphQL('GraphQL users query completed', { 
                userId: ctx.user?.sub,
                count: users?.length || 0 
            });
            return users || [];
        } catch (error) {
            logError('Error in users query', error as Error, { userId: ctx.user?.sub });
            throw error;
        }
    },
    
    // get user by id
    user: async (_: any, { id }: { id: string }, ctx: any) => {
        requireAuth(ctx);
        try {
            logGraphQL('GraphQL user query called', { 
                userId: ctx.user?.sub, 
                targetUserId: id 
            });
            const user = await UserModel.findById(id).lean();
            logGraphQL('GraphQL user query completed', { 
                userId: ctx.user?.sub,
                targetUserId: id,
                found: !!user 
            });
            return user;
        } catch (error) {
            logError('Error in user query', error as Error, { 
                userId: ctx.user?.sub,
                targetUserId: id 
            });
            throw error;
        }
    },
}