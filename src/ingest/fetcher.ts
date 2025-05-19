import { MDocument } from "@mastra/rag";
import path from "path";
import fs from "fs";
export async function fetchFromGitHub(orgName: string, repoName: string) {
  console.log(`Fetching from GitHub: ${orgName}/${repoName}`);

  // First, get the repository info to find the default branch
  interface GitHubRepoResponse {
    default_branch: string;
    [key: string]: any;
  }

  const repoResponse = await fetch(
    `https://api.github.com/repos/${orgName}/${repoName}`
  );
  const repoData = (await repoResponse.json()) as GitHubRepoResponse;
  console.log("Repository data fetched", repoData);
  const defaultBranch = repoData.default_branch;

  const response = await fetch(
    `https://api.github.com/repos/${orgName}/${repoName}/git/trees/${defaultBranch}?recursive=1`
  );
  const data = await response.json();

  console.log("GitHub data fetched", data);

  const files = (data as any).tree.map((file: any) => ({
    path: file.path,
    url: `https://github.com/${orgName}/${repoName}/blob/${defaultBranch}/${file.path}`,
  }));

  const pages = new Map<string, string>();

  for (const file of files) {
    console.log(`Fetching: ${file.url}`);
    const response = await fetch(file.url);
    const content = await response.text();
    pages.set(file.url, content);
  }

  console.log(`Found ${pages.size} MDX files`);
  return pages;
}

export async function generateChunks(pages: Map<string, string>) {
  const allChunks = [];
  for (const [filePath, content] of pages) {
    const doc = MDocument.fromMarkdown(content);
    const chunks = await doc.chunk({
      strategy: "recursive",
      size: 512,
      overlap: 50,
      separator: "\n\n",
    });

    allChunks.push(
      ...chunks.map((chunk) => ({
        text: chunk.text,
        source: filePath,
      }))
    );
  }

  console.log("Total number of chunks:", allChunks.length);
  return allChunks;
}

export function saveChunksToCsv(
  chunks: { text: string; source: string }[],
  indexName: string
) {
  const csvContent = chunks
    .map((chunk) => {
      const escapedText = chunk.text.replace(/"/g, '""');
      return `"${chunk.source}","${escapedText}"`;
    })
    .join("\n");

  // Add CSV header
  const csvWithHeader = "source,content\n" + csvContent;

  // Write to CSV file
  const csvPath = path.join(__dirname, `${indexName}.csv`);
  fs.writeFileSync(csvPath, csvWithHeader);
  console.log(`CSV file written to: ${csvPath}`);
}
