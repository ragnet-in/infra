import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

export async function generateEmbeddings(
  chunks: { text: string; source: string }[]
) {
  // Continue with embeddings if needed
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: chunks.map((chunk) => chunk.text),
  });

  console.log("Embeddings done");
  return embeddings;
}
