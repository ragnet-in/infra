interface QueryResponse {
  answer: string;
}
export interface DashboardAnalytics {
  topics: {
    topic: string;
    count: number;
    subtopics: string[];
  }[];
  sources: {
    source: string;
    frequency: number;
  }[];
  actions: string[];
}


export const initRag = async (orgId: string): Promise<boolean> => {
    console.log("init rag for; ", orgId);
    const response = await fetch(`${process.env.RAG_API_URL}/init?orgId=${orgId}`, {
        method: "POST",
        headers: {
          "X-infra-rag-key": `x-${process.env.INFRA_RAG_KEY}`
        }
    });
    return response.ok;
};

export const buildRagGraph = async (orgId: string, url: string): Promise<boolean> => {
    console.log("build graph for ", orgId, url)
    const response = await fetch(`${process.env.RAG_API_URL}/buildGraph?orgId=${orgId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-infra-rag-key": `x-${process.env.INFRA_RAG_KEY}`
        },
        body: JSON.stringify({ url })
    });

    return response.ok;
};

export const getRagResponse = async (orgId:string, query: string, completePrompt: string): Promise<[string, boolean]> =>{
    const response = await fetch(`${process.env.RAG_API_URL}/query?orgId=${orgId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-infra-rag-key": `x-${process.env.INFRA_RAG_KEY}`
      },
      body: JSON.stringify({ query, "prompt":completePrompt })
    });
    const data = (await response.json()) as QueryResponse;
    return [data.answer, true];
}

export const getRagInsights = async (orgId:string, conversationHistory: string): Promise<[DashboardAnalytics, boolean]> =>{
    const response = await fetch(`${process.env.RAG_API_URL}/insights?orgId=${orgId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-infra-rag-key": `x-${process.env.INFRA_RAG_KEY}`
      },
      body: JSON.stringify({ "history":conversationHistory })
    });
    const resp = await response.json();
    const data = (resp) as DashboardAnalytics;
    return [data, true];
}
