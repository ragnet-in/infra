import express from "express";
import { config } from "dotenv";
import {
  queryEndpoint,
  authenticateUser,
  getOrganizations,
  createOrganization,
  createSource,
  getSources,
  getConversationsFromOrg,
  getDashboardAnalytics,
  addGuardRails,
  getGuardRails,
  addOrgPrompt,
  getOrgPrompt,
  getVersion,
  generateAPIKey, 
  deleteAPIKey,
  addAdminToOrg,
} from "./controller";
import { authMiddleware } from "./middleware/auth";
import cors from "cors";
import { Migrator } from './database/migrate';

config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3002",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const PORT = process.env.PORT || 3000;

// Initialize our services
Migrator.migrateToLatest();

// Public routes
app.get("/version", getVersion)
app.post("/api/register", authenticateUser);
app.post("/api/query", queryEndpoint);

app.post("/api/organizations", authMiddleware, createOrganization);
app.get("/api/organizations", authMiddleware, getOrganizations);
app.post("/api/sources", authMiddleware, createSource);
app.get("/api/sources/:orgId", authMiddleware, getSources);
app.post("/api/guardrails", authMiddleware, addGuardRails);
app.get("/api/guardrails/:orgId", authMiddleware, getGuardRails);
app.post("/api/orgPrompt", authMiddleware, addOrgPrompt);
app.get("/api/orgPrompt/:orgId", authMiddleware, getOrgPrompt);
app.get("/api/conversations/:orgId", authMiddleware, getConversationsFromOrg);
app.get("/api/dashboard/:orgId", authMiddleware, getDashboardAnalytics);

app.get("/api/generateApiKey/:orgId", authMiddleware, generateAPIKey);
app.delete("/api/deleteApiKey/:orgId", authMiddleware, deleteAPIKey);
app.post("/api/addAdminToOrg/:orgId", authMiddleware, addAdminToOrg);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
