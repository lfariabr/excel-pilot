import UserModel from "../../models/User";
import { requireAuth } from "../../utils/guards";

export const usersQuery = {
    // get all users
    users: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        try {

        // testing
        // curl -X POST http://localhost:4000/graphql \
        //   -H "Content-Type: application/json" \
        //   -d '{"query":"{ users { id name email role } }"}'
            console.log('🔍 GraphQL users query called');
            const users = await UserModel.find().lean();
            console.log('📊 Found users:', users?.length || 0);
            return users || [];
        } catch (error) {
            console.error('❌ Error in users query:', error);
            throw error;
        }
    },
    
    // get user by id
    user: async (_: any, { id }: { id: string }, ctx: any) => {
        requireAuth(ctx);
        try {
            console.log('🔍 GraphQL user query called with id:', id);
            const user = await UserModel.findById(id).lean();
            console.log('📊 Found user:', user ? 'yes' : 'no');
            return user;
        } catch (error) {
            console.error('❌ Error in user query:', error);
            throw error;
        }
    },
}