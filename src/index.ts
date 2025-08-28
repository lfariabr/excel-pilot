import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import userRouter from './routes/user';
import "dotenv/config";
import { Request, Response, NextFunction } from 'express';
import { AppError } from './utils/errorHandler';

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/conciApi";
const PORT = Number(process.env.PORT) || 4000;

const app = express();

app.use(cors()); // protection against cross-site requests
app.use(helmet()); // Middleware for security headers
app.use(express.json()); // Middleware for parsing JSON bodies

app.get("/health", (_req, res) => res.json({ // Health check endpoint
    ok: true
}))

app.use("/users", userRouter); // REST API for users

app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
});

export default app;

async function main() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('\n... ✅ Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`\n... 🚀 REST ready at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.log('\n... ❌ MongoDB connection error:', error);
    }
}

main();
