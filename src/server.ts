import express from "express";
import { config } from "dotenv";
import { initPgVector } from "./vectorDb";
import { initialiseMastra } from "./mastra";
import {
  ingestEndpoint,
  queryEndpoint,
  registerUser,
  createRepo,
} from "./controller";
import { authMiddleware } from "./middleware/auth";
import { initDb } from "./db/users";
config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize our services
initDb();
initPgVector();
initialiseMastra();
// Public routes
app.post("/api/register", registerUser);
app.post("/api/query", queryEndpoint);

// Protected routes
app.post("/api/repositories", authMiddleware, createRepo);
app.post("/api/ingest", authMiddleware, ingestEndpoint);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
