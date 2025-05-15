import { Mastra, Agent } from "@mastra/core";
import { pgVector } from "./vectorDb";

export let mastra: Mastra;

export const initialiseMastra = (devRelAgent?: Agent) => {
  mastra = new Mastra({
    ...(devRelAgent && { agents: { devRelAgent } }),
    vectors: { pgVector },
  });
  return mastra;
};
