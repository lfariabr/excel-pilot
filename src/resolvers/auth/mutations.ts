import UserModel from "../../models/User";
import { GraphQLError } from "graphql";
import { RegisterSchema , LoginSchema } from "../../validation/auth.schema";
import { signAccessToken } from "../../utils/jwt";

export const authMutations = {
    register: async (_: any, args: any) => {
        const parsed = RegisterSchema.parse(args.input);
        const { name, email, password, role } = parsed;

        const exists = await UserModel.findOne({ email });
        if (exists) {
            throw new GraphQLError("Email already in use", {
                extensions: {
                    code: "EMAIL_ALREADY_IN_USE",
                    httpCode: 400,
                }
            });
        }

        const user = await UserModel.create({ name, email, password, role: role || "casual" });
        const accessToken = signAccessToken({
            sub: user.id,
            role: user.role,
            email: user.email,
        })
        
        return {
            accessToken,
            user,
        };
    },
    login: async (_: any, args: any) => {
        const parsed = LoginSchema.parse(args.input);
        const { email, password } = parsed;

        const user = await UserModel.findOne({ email }).select('+password');
        if (!user) {
            throw new GraphQLError("Invalid email or password", {
                extensions: {
                    code: "UNAUTHENTICATED",
                }
            });
        }

        const ok = await user.comparePassword(password);
        if (!ok) {
            throw new GraphQLError("Invalid email or password", {
                extensions: {
                    code: "UNAUTHENTICATED",
                }
            });
        }

        const accessToken = signAccessToken({
            sub: user.id,
            role: user.role,
            email: user.email,
        });

        // Never return the password
        user.password = undefined as any;
        
        return {
            accessToken,
            user,
        };
    }
}