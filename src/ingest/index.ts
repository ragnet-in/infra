import { config } from "dotenv";
import { generateChunks, saveChunksToCsv, fetchFromGitHub } from "./fetcher";
import { generateEmbeddings } from "./ai";
import { createIndex, upsert, createVectorStore, getIndexName } from "../db";
import { mastra } from "../mastra";
config();

export async function loadDataFromGithub(
  orgName: string,
  repoName: string,
  branch: string,
  subdir: string,
  fileFormat: string
) {
  // Fetch all MDX files
  const pages = await fetchFromGitHub(
    orgName,
    repoName,
    branch,
    subdir,
    fileFormat
  );

  // Process each page
  const allChunks = await generateChunks(pages);

  // Create CSV content
  saveChunksToCsv(allChunks, getIndexName(orgName, repoName));

  // Generate embeddings
  const embeddings = await generateEmbeddings(allChunks);

  const vectorStore = createVectorStore(mastra);

  // Create an index for our docs chunks
  await createIndex(vectorStore, getIndexName(orgName, repoName));

  // Store embeddings
  await upsert(
    vectorStore,
    getIndexName(orgName, repoName),
    embeddings,
    allChunks.map((chunk) => ({
      text: chunk.text,
      source: chunk.source,
    }))
  );
}
