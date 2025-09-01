import UserModel from "../../models/User";

export const authQueries = {
    me: async (_: any, __: any, ctx: any) => {
        if (!ctx.user) return null;
        const user = await UserModel.findById(ctx.user.sub);
        return user;
    },
}