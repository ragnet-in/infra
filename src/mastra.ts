import { Mastra, Agent } from "@mastra/core";
import { pgVector } from "./db";

export let mastra: Mastra;

// Initialize Mastra instance
export const initialiseMastra = (devRelAgent: Agent) => {
  mastra = new Mastra({
    agents: { devRelAgent },
    vectors: { pgVector },
  });
  return mastra;
};
