import { PgVector } from "@mastra/pg";
import { config } from "dotenv";
import { Mastra } from "@mastra/core";
config();

export let pgVector: PgVector;

export const initPgVector = () => {
  pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);
  return pgVector;
};

export const createVectorStore = (mastra: Mastra) => {
  return mastra.getVector("pgVector");
};

export const createIndex = async (vectorStore: any, indexName: string) => {
  await vectorStore.createIndex({
    indexName: replaceSpecialCharactersWithUnderscores(indexName),
    dimension: 1536,
  });
};

export const upsert = async (
  vectorStore: any,
  indexName: string,
  vectors: any[],
  metadata: any[]
) => {
  await vectorStore.upsert({
    indexName: replaceSpecialCharactersWithUnderscores(indexName),
    vectors,
    metadata,
  });
};

export const replaceSpecialCharactersWithUnderscores = (text: string) => {
  return text.replace(/[^a-zA-Z0-9\s]/g, "_");
};

export const getIndexName = (orgId: string) => {
  return `org_${replaceSpecialCharactersWithUnderscores(orgId)}`;
};
