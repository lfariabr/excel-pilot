// server.ts — the only file that starts listening
import mongoose from "mongoose";
import http from "http";

// Express
import { createApp } from "./app";

// GraphQL / Apollo Server
import { attachGraphQL } from "./graphql";

async function start() {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('\n... ✅ Connected to MongoDB')
  
    const app = createApp();
    const httpServer = http.createServer(app);
  
    await attachGraphQL(app, httpServer);
  
    const PORT = Number(process.env.PORT) || 4000;
    httpServer.listen(PORT, () => {
      console.log(`... 🚀 REST ready at http://localhost:${PORT}`);
      console.log(`... ⚙️ GraphQL ready at http://localhost:${PORT}/graphql`);
    });
  
    // Graceful shutdown
    process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
    process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
  }
  
  start().catch((e) => {
    console.error("Fatal startup error:", e);
    process.exit(1);
  });