// graphql.ts — wires Apollo onto the app

// Express
import http from "http";
import express from "express";
import { expressMiddleware } from "@as-integrations/express5";

// GraphQL
import { typeDefs } from "./schemas/typeDefs";
import { resolvers } from "./resolvers";

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
      // Log rawErr to pino/Datadog
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
        // const user = await verifyJWT(req.headers.authorization);
        // const loaders = makeLoaders();
        return { req, res /*, user, loaders, redis */ };
      },
    })
  );
}