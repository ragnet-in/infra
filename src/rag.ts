interface QueryResponse {
  answer: string;
}

export const initRag = async (orgId: string): Promise<boolean> => {
    console.log("init rag for; ", orgId);
    const response = await fetch(`${process.env.RAG_API_URL}/init?orgId=${orgId}`, {
        method: "POST"
    });
    return response.ok;
};

export const buildRagGraph = async (orgId: string, url: string): Promise<boolean> => {
    console.log("build graph for ", orgId, url)
    const response = await fetch(`${process.env.RAG_API_URL}/buildGraph?orgId=${orgId}`, {
        method: "POST",
        headers: {
        "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
    });

    return response.ok;
};

export const getRagResponse = async (orgId:string, query: string, completePrompt: string): Promise<[string, boolean]> =>{
    const response = await fetch(`${process.env.RAG_API_URL}/query?orgId=${orgId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, "prompt":completePrompt })
    });
    const data = (await response.json()) as QueryResponse;
    return [data.answer, true];
}


