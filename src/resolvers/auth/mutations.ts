import UserModel from "../../models/User";
import { GraphQLError } from "graphql";
import { RegisterSchema , LoginSchema } from "../../validation/auth.schema";
import { signAccessToken } from "../../utils/jwt";
import { logAuth, logSecurity, logError } from "../../utils/logger";

export const authMutations = {
    register: async (_: any, args: any) => {
        try {
            const parsed = RegisterSchema.parse(args.input);
            const { name, email, password, role } = parsed;

            logAuth('Registration attempt', { 
                email,
                role: role
            });

            const exists = await UserModel.findOne({ email });
            if (exists) {
                logSecurity('Registration failed - email already exists', {
                    email,
                    attemptedRole: role
                });
                throw new GraphQLError("Email already in use", {
                    extensions: {
                        code: "EMAIL_ALREADY_IN_USE",
                        httpCode: 400,
                    }
                });
            }

            const user = await UserModel.create({ name, email, password, role: role });
            const accessToken = signAccessToken({
                sub: user.id,
                role: user.role,
                email: user.email,
            });

            logAuth('User registered successfully', {
                userId: user.id,
                email: user.email,
                role: user.role
            });
            
            return {
                accessToken,
                user,
            };
        } catch (error) {
            if (error instanceof GraphQLError) {
                throw error; // Re-throw GraphQL errors (already logged)
            }
            logError('Registration error', error as Error, {
                email: args.input?.email
            });
            throw error;
        }
    },
    login: async (_: any, args: any) => {
        try {
            const parsed = LoginSchema.parse(args.input);
            const { email, password } = parsed;

            logAuth('Login attempt', { email });

            const user = await UserModel.findOne({ email }).select('+password');
            if (!user) {
                logSecurity('Login failed - user not found', { email });
                throw new GraphQLError("Invalid email or password", {
                    extensions: {
                        code: "UNAUTHENTICATED",
                    }
                });
            }

            const ok = await user.comparePassword(password);
            if (!ok) {
                logSecurity('Login failed - invalid password', { 
                    email,
                    userId: user.id 
                });
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

            logAuth('User logged in successfully', {
                userId: user.id,
                email: user.email,
                role: user.role
            });

            // Never return the password
            user.password = undefined as any;
            
            return {
                accessToken,
                user,
            };
        } catch (error) {
            if (error instanceof GraphQLError) {
                throw error; // Re-throw GraphQL errors (already logged)
            }
            logError('Login error', error as Error, {
                email: args.input?.email
            });
            throw error;
        }
    }
}