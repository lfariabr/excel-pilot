import UserModel from "../../models/User";
import { requireAuth } from "../../utils/guards";

export const authQueries = {
    me: async (_: any, __: any, ctx: any) => {
        requireAuth(ctx);
        if (!ctx.user) return null;
        const user = await UserModel.findById(ctx.user.sub);
        return user;
    },
}