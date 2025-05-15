import { MDocument } from "@mastra/rag";
import path from "path";
import fs from "fs";
export async function fetchFromGitHub(
  orgName: string,
  repoName: string,
  branch: string,
  subdir: string,
  fileFormat: string
) {
  const response = await fetch(
    `https://api.github.com/repos/${orgName}/${repoName}/git/trees/${branch}?recursive=1`
  );
  const data = await response.json();

  const files = (data as any).tree
    .filter(
      (file: any) =>
        file.path.startsWith(subdir) && file.path.endsWith(fileFormat)
    )
    .map((file: any) => ({
      path: file.path,
      url: `https://github.com/${orgName}/${repoName}/blob/${branch}/${file.path}`,
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
