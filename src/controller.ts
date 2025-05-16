import { Request, Response, NextFunction } from "express";
import { loadDataFromGithub } from "./ingest";
import { initialiseDevRelAgent } from "./agent";
import jwt from "jsonwebtoken";
import { AuthRequest } from "./types";
import { createUser, createRepository, getRepositoryById } from "./db/users";
import { config } from "dotenv";
import { initialiseMastra } from "./mastra";

config();

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await createUser(email, password);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Failed to register user" });
  }
};

export const createRepo = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, orgName, repoName } = req.body;
    const userId = req.user!.id;

    const repository = await createRepository(userId, name, orgName, repoName);
    res.status(201).json(repository);
  } catch (error) {
    next(error);
  }
};

export const ingestEndpoint = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { repoId, branch, subdir, fileFormat } = req.body;

    const repository = await getRepositoryById(repoId);
    if (!repository) {
      res.status(404).json({ error: "Repository not found" });
      return;
    }

    await loadDataFromGithub(
      repository.org_name,
      repository.repo_name,
      branch,
      subdir,
      fileFormat
    );

    res.status(200).json({ message: "Ingestion completed" });
  } catch (error) {
    next(error);
  }
};

export const queryEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query, repoId } = req.body;

    const repository = await getRepositoryById(repoId);
    if (!repository) {
      res.status(404).json({ error: "Repository not found" });
      return;
    }

    const devRelAgent = initialiseDevRelAgent(
      repository.org_name,
      repository.repo_name
    );
    // Initialize Mastra with the agent
    const mastra = initialiseMastra(devRelAgent);

    // Get the agent from Mastra instance
    const agent = mastra.getAgent("devRelAgent");
    const response = await agent.generate(query);

    res.json({
      success: true,
      response: response.text,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to process query",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
