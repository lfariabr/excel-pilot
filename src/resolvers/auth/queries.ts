import UserModel from "../../models/User";
import { requireAuth } from "../../utils/guards";
import { logAuth, logError } from "../../utils/logger";


export const authQueries = {
    me: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) return null;
        
        try {
            logAuth('Fetching user profile', {
                userId: ctx.user.sub,
                email: ctx.user.email,
                role: ctx.user.role
            });
            const user = await UserModel.findById(ctx.user.sub);
            
            logAuth('User profile fetched successfully', {
                userId: ctx.user.sub,
                found: !!user,
                email: user?.email,
                role: user?.role
            });
            
            return user;
        } catch (error) {
            logError('Error fetching user profile', error as Error, {
                userId: ctx.user.sub
            });
            throw error;
        }
    },
}