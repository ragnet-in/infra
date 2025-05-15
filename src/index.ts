import { loadDataFromGithub } from "./ingest";
import { config } from "dotenv";
import { initPgVector } from "./db";
import { initialiseDevRelAgent } from "./agent";
import { initialiseMastra } from "./mastra";

config();

const orgName = "mastra-ai";
const repoName = "mastra";
const branch = "main";
const subdir = "docs/src/content/en/docs/evals";
const fileFormat = ".mdx";

async function main() {
  initPgVector();
  const devRelAgent = initialiseDevRelAgent(orgName, repoName);
  const mastra = initialiseMastra(devRelAgent);

  if (process.env.INGEST_DOCS === "true") {
    loadDataFromGithub(orgName, repoName, branch, subdir, fileFormat).catch(
      console.error
    );
  } else {
    // Basic query about concepts
    const agent = mastra.getAgent("devRelAgent");
    const query1 =
      "Hi team, I'm looking at ways to test my agents but couldn't find any specific or complete examples in the documentation. The idea is to build a robuste set of rules that you can test against when you are making prompt tweaks. Anyone accomplished that?";
    const response1 = await agent.generate(query1);
    console.log("\nQuery:", query1);
    console.log("Response:", response1.text);
  }
}

main().catch(console.error);
