import UserModel from "../../models/User";
import { GraphQLError } from "graphql";
import { RegisterSchema , LoginSchema } from "../../validation/auth.schema";
import { signAccessToken } from "../../utils/jwt";

export const authQueries = {
    me: async (_: any, __: any, ctx: any) => {
        if (!ctx.user) return null;
        const user = await UserModel.findById(ctx.user.sub);
        return user;
    },
}