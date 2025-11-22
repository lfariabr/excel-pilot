import UserModel from "../../models/User";
import { requireAuth, requireRole } from "../../utils/guards";
import { logGraphQL, logAuth, logError } from "../../utils/logger";
import mongoose from "mongoose";

export const usersMutation = {

    // testing
    // curl -X POST http://localhost:4000/graphql \
    //   -H "Content-Type: application/json" \
    //   -d '{"query":"mutation { createUser(name: \"Louis\", email: \"louis@example.com\", role: manager) { id name email role } }"}'

    createUser: async (_: any, { 
        name, 
        email, 
        role }: { 
            name: string, 
            email: string, 
            role: string 
        }) => {
        try {
            logGraphQL('GraphQL createUser called', { name, email, role });
            const user = await UserModel.create({ name, email, role });
            logAuth('User created successfully', {
                userId: (user._id as mongoose.Types.ObjectId).toString() as string,
                email,
                role
            });
            return user;
        } catch (error) {
            logError('Error creating user', error as Error, { name, email, role });
            throw error;
        }
    },
    
    // update user
    updateUser: async (_: any, { 
        id, 
        name, 
        email, 
        role }: { 
            id: string, 
            name?: string, 
            email?: string, 
            role?: string 
        }, ctx: any) => {
        try {
            requireAuth(ctx);
            logGraphQL('GraphQL updateUser called', { 
                userId: ctx.user?.sub,
                targetUserId: id,
                updates: { name, email, role } 
            });
            const user = await UserModel.findByIdAndUpdate(
                id, 
                { name, email, role }, 
                { new: true }
            );
            logAuth('User updated successfully', {
                userId: ctx.user?.sub,
                targetUserId: id
            });
            return user;
        } catch (error) {
            logError('Error updating user', error as Error, { 
                userId: ctx.user?.sub,
                targetUserId: id 
            });
            throw error;
        }
    },
    
    // delete user
    deleteUser: async (_: any, { id }: { id: string }, ctx: any) => {
        try {
            requireRole(ctx, ["admin"]);
            logAuth('Admin attempting to delete user', {
                userId: ctx.user?.sub,
                targetUserId: id,
                role: ctx.user?.role
            });
            const user = await UserModel.findByIdAndDelete(id);
            logAuth('User deleted successfully', {
                userId: ctx.user?.sub,
                targetUserId: id
            });
            return user;
        } catch (error) {
            logError('Error deleting user', error as Error, { 
                userId: ctx.user?.sub,
                targetUserId: id 
            });
            throw error;
        }
    },
}