import { config } from "dotenv";
import { generateChunks, saveChunksToCsv, fetchFromGitHub } from "./fetcher";
import { generateEmbeddings } from "./ai";
import {
  createIndex,
  upsert,
  createVectorStore,
  getIndexName,
} from "../vectorDb";
import { mastra } from "../mastra";
import { fetchFromDiscord } from "./discordFetcher";
config();

export async function loadDataFromGithub(
  orgName: string,
  repoName: string,
  orgId: string
) {
  // Fetch all MDX files
  const pages = await fetchFromGitHub(orgName, repoName);

  // Process each page
  const allChunks = await generateChunks(pages);

  // Create CSV content
  saveChunksToCsv(allChunks, getIndexName(orgId));

  // Generate embeddings
  const embeddings = await generateEmbeddings(allChunks);
  console.log("Embeddings generated");

  const vectorStore = createVectorStore(mastra);
  console.log("Vector store created");
  // Create an index for our docs chunks
  await createIndex(vectorStore, getIndexName(orgId));
  console.log("Index created");
  // Store embeddings
  await upsert(
    vectorStore,
    getIndexName(orgId),
    embeddings,
    allChunks.map((chunk) => ({
      text: chunk.text,
      source: chunk.source,
    }))
  );
  console.log("Upserted");
}

export async function loadDataFromDiscord(guildId: string, orgId: string) {
  // Fetch all Discord messages
  const pages = await fetchFromDiscord(guildId);

  // Process each page
  const allChunks = await generateChunks(pages);

  // Create CSV content
  saveChunksToCsv(allChunks, getIndexName(orgId));

  // Generate embeddings
  const embeddings = await generateEmbeddings(allChunks);

  const vectorStore = createVectorStore(mastra);

  // Create an index for our docs chunks
  await createIndex(vectorStore, getIndexName(orgId));

  // Store embeddings
  await upsert(
    vectorStore,
    getIndexName(orgId),
    embeddings,
    allChunks.map((chunk) => ({
      text: chunk.text,
      source: chunk.source,
    }))
  );
}
