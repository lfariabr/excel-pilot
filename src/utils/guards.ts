import { GraphQLError } from "graphql";

export function requireAuth(ctx: any) {
  if (!ctx.user) {
    throw new GraphQLError("Unauthenticated", {
        extensions: { code: "UNAUTHENTICATED" } 
    });
  }
}

export function requireRole(ctx: any, roles: string[]) {
  requireAuth(ctx);
  if (!roles.includes(ctx.user.role)) {
    throw new GraphQLError("Forbidden", {
        extensions: { code: "FORBIDDEN" } 
    });
  }
}