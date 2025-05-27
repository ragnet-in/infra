import express from "express";
import { config } from "dotenv";
import { initPgVector } from "./vectorDb";
import { initialiseMastra } from "./mastra";
import {
  queryEndpoint,
  authenticateUser,
  getOrganizations,
  createOrganization,
  createSource,
  getSources,
  initiateDiscordAuth,
  handleDiscordCallback,
  getConversationsFromOrg,
  getDashboardAnalytics,
  addGuardRails,
  getGuardRails,
  addOrgPrompt,
  getOrgPrompt,
  getVersion,
} from "./controller";
import { authMiddleware } from "./middleware/auth";
import { initDb } from "./db/init";
import { initDiscord } from "./discord/init";
import cors from "cors";
config();

const app = express();
app.use(express.json());
app.use(
  cors({
    // origin: ,
    origin: "http://localhost:3001",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const PORT = process.env.PORT || 3000;

// Initialize our services
initDb();
initPgVector();
initialiseMastra();
initDiscord();

// Public routes
app.get("/version", getVersion)
app.post("/api/register", authenticateUser);
app.post("/api/query", queryEndpoint);

// Protected routes

// Org routes
app.post("/api/organizations", authMiddleware, createOrganization);
app.get("/api/organizations", authMiddleware, getOrganizations);
app.post("/api/sources", authMiddleware, createSource);
app.get("/api/sources/:orgId", authMiddleware, getSources);
app.post("/api/sources/discord/auth", authMiddleware, initiateDiscordAuth);
app.get("/api/auth/discord/callback", handleDiscordCallback);
app.post("/api/guardrails", addGuardRails);
app.get("/api/guardrails/:orgId", getGuardRails);
app.post("/api/orgPrompt", addOrgPrompt);
app.get("/api/orgPrompt/:orgId", getOrgPrompt);

// Conversation routes
app.get("/api/conversations/:orgId", authMiddleware, getConversationsFromOrg);

// Dashboard routes
app.get("/api/dashboard/:orgId", authMiddleware, getDashboardAnalytics);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
