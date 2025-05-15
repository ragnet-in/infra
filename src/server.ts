import express from "express";
import { config } from "dotenv";
import { initPgVector } from "./vectorDb";
import { initialiseMastra } from "./mastra";
import { ingestEndpoint, queryEndpoint } from "./controller";
config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize our services
initPgVector();
initialiseMastra();

// Ingest endpoint
app.post("/api/ingest", ingestEndpoint);

// Query endpoint
app.post("/api/query", queryEndpoint);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
