// graphql.ts — wires Apollo onto the app

// Express
import http from "http";
import express from "express";
import { expressMiddleware } from "@as-integrations/express5";
import { logError, logHTTP } from "./utils/logger";

// GraphQL
import { typeDefs } from "./schemas/typeDefs";
import { resolvers } from "./resolvers";
import { verifyAccessToken } from "./utils/jwt";

// Apollo Server
import { ApolloServer } from "@apollo/server";
import { 
  ApolloServerPluginDrainHttpServer,
} from "@apollo/server/plugin/drainHttpServer";
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault
} from "@apollo/server/plugin/landingPage/default";

export async function attachGraphQL(
  app: express.Express,
  httpServer: http.Server
) {
  const isDev = process.env.NODE_ENV !== "production";

  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: isDev,
    csrfPrevention: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      isDev
        ? ApolloServerPluginLandingPageLocalDefault({ embed: true, footer: false })
        : ApolloServerPluginLandingPageProductionDefault({ footer: false }),
    ],
    formatError: (formattedErr, rawErr) => {
      // Log GraphQL errors
      logError('GraphQL Error', rawErr as Error, {
        message: formattedErr.message,
        code: formattedErr.extensions?.code as string,
        path: formattedErr.path?.join('.'),
      });
      
      if (process.env.NODE_ENV === "production") { // don't leak stack traces in production
        return { 
          message: formattedErr.message, 
          extensions: formattedErr.extensions 
        };
      }
      return formattedErr;
    },
  });

  await apollo.start();

  // OPTIONAL: route-level Helmet CSP (keeps global helmet strict)
  // app.use("/graphql", helmet(isDev ? { contentSecurityPolicy: false } : yourStrictCsp));

  app.use(
    "/graphql",
    expressMiddleware(apollo, {
      context: async ({ req, res }) => {
        // Put per-request stuff here: user, redis, dataloaders

        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
        const decoded = verifyAccessToken(token);
        // ctx.user will be null or { sub: string; role: string; email: string }

        // const loaders = makeLoaders();
        return { 
          req, 
          res, 
          user: decoded,
          /*, user, loaders, redis */ 
        };
      },
    })
  );
}

/**
 * Register 404 handler AFTER all routes (including GraphQL)
 * This must be called after attachGraphQL to avoid catching GraphQL requests
 */
export function register404Handler(app: express.Express) {
  app.use((_req: express.Request, res: express.Response) => {
    logHTTP('404 Not Found', {
      path: _req.path,
      method: _req.method,
      statusCode: 404
    });
    res.status(404).json({ error: "Not found" });
  });
}