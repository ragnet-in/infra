import { Request, Response } from "express";
import { loadDataFromGithub } from "./ingest";
import { initialiseMastra } from "./mastra";
import { initialiseDevRelAgent } from "./agent";

export const ingestEndpoint = async (req: Request, res: Response) => {
  try {
    const { orgName, repoName, branch, subdir, fileFormat } = req.body;

    if (!orgName || !repoName || !branch || !subdir || !fileFormat) {
      res.status(400).json({
        error: "Missing required parameters",
      });
    }

    await loadDataFromGithub(orgName, repoName, branch, subdir, fileFormat);
    res.json({ success: true, message: "Data ingested successfully" });
  } catch (error) {
    console.error("Ingest error:", error);
    res.status(500).json({
      error: "Failed to ingest data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const queryEndpoint = async (req: Request, res: Response) => {
  try {
    const { query, orgName, repoName } = req.body;

    if (!query) {
      res.status(400).json({
        error: "Query is required",
      });
    }
    const devRelAgent = initialiseDevRelAgent(orgName, repoName);
    const mastra = initialiseMastra(devRelAgent);

    const agent = mastra.getAgent("devRelAgent");
    const response = await agent.generate(query);

    res.json({
      success: true,
      response: response.text,
    });
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({
      error: "Failed to process query",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
