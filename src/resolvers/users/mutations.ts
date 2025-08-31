import UserModel from "../../models/User";
import { requireAuth, requireRole } from "../../utils/guards";

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
            console.log('🔍 GraphQL createUser called with:', { name, email, role });
            const user = await UserModel.create({ name, email, role });
            console.log('✅ User created:', user?._id);
            return user;
        } catch (error) {
            console.error('❌ Error creating user:', error);
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
            console.log('🔍 GraphQL updateUser called with:', { id, name, email, role });
            const user = await UserModel.findByIdAndUpdate(
                id, 
                { name, email, role }, 
                { new: true }
            );
            console.log('✅ User updated:', user?._id);
            return user;
        } catch (error) {
            console.error('❌ Error updating user:', error);
            throw error;
        }
    },
    
    // delete user
    deleteUser: async (_: any, { id }: { id: string }, ctx: any) => {
        try {
            console.log('Checking auth...')
            requireRole(ctx, ["admin"]);
            console.log('🔍 GraphQL deleteUser called with id:', id);
            const user = await UserModel.findByIdAndDelete(id);
            console.log('✅ User deleted:', user?._id);
            return user;
        } catch (error) {
            console.error('❌ Error deleting user:', error);
            throw error;
        }
    },
}