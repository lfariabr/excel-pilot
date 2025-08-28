import mongoose from 'mongoose';

// Express Setup
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import userRouter from './routes/user';
import "dotenv/config";
import { Request, Response, NextFunction } from 'express';
import { AppError } from './utils/errorHandler';

// GraphQL Setup
import { typeDefs } from './schemas/typeDefs';
import { resolvers } from './resolvers';

// Apollo
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/conciApi";
const PORT = Number(process.env.PORT) || 4000;

const app = express();

app.use(cors()); // protection against cross-site requests
app.use(helmet()); // sets safe HTTP headers (CSP/XSS/Frameguard/etc.)
app.use(express.json()); // parses JSON so req.body works

app.get("/health", (_req, res) => res.json({ // Health check endpoint
    ok: true
}))

app.get("/ready", (_req, res) => {
    const up = mongoose.connection.readyState === 1;
    res.status(up ? 200 : 503).json({
        mongo: up,
    })
})

app.use("/users", userRouter); // REST API for users

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Duplicate key", details: err.keyValue });
    }
    const status = err instanceof AppError ? err.status : 500;
    res.status(status).json({ error: err.message || "Server error" });
});

export default app;

async function main() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('\n... ✅ Connected to MongoDB');

        // Setup Apollo Server
        const apollo = new ApolloServer({
            typeDefs, 
            resolvers,
            introspection: true,
            csrfPrevention: true,
        });
        await apollo.start();
        app.use("/graphql", expressMiddleware(apollo, {
            context: async ({ req, res }) => ({ req, res }) // add auth here later
        }));

        app.listen(PORT, () => {
            console.log(`\n... 🚀 REST ready at http://localhost:${PORT}`);
            console.log(`\n... 🚀 GraphQL ready at http://localhost:${PORT}/graphql`);
        });
    } catch (error) {
        console.log('\n... ❌ MongoDB connection error:', error);
    }
}

main();
