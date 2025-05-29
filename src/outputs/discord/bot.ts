import { Client, GatewayIntentBits, Message, ThreadChannel } from "discord.js";
import {
  createConversation,
  addMessageToConversation,
  getConversationHistory,
} from "../../db/conversations";
import {
    getPromptForOrg,
    getGuardRailsForOrg
} from "../../db/preferences"
import { getRagResponse } from "../../rag";

export class DiscordBot {
  private client: Client;
  private orgId: string;
  private orgName: string;

  constructor(orgId: string, orgName: string) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.orgId = orgId;
    this.orgName = orgName;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on("messageCreate", async (message) => {
      // Ignore messages from bots
      if (message.author.bot) return;

      // Check if the bot was mentioned
      if (message.mentions.has(this.client.user!)) {
        await this.handleBotMention(message);
      }
    });

    this.client.once("ready", () => {
      console.log(`Bot is ready! Logged in as ${this.client.user?.tag}`);
    });
  }

  private async handleBotMention(message: Message) {
    try {
        const question = message.content.replace(/<@!\d+>/g, "").trim();
        const threadName = this.createThreadName(question);

        // Create a new thread
        const thread = await message.startThread({
            name: threadName,
            autoArchiveDuration: 60,
        });

        // doubt: isn't this per thread basis? ohh! every thread will have ragnet mentioned multiple times?
        // Create or get conversation
        const conversation = await createConversation(this.orgId); // see how to do on discord per thread basis

        // Add user message to history
        await addMessageToConversation(conversation.id, question, "user");
        const history = await getConversationHistory(conversation.id);

        const contextualQuery = `Previous conversation: ${history.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}`;
        const orgPrompt = await getPromptForOrg(this.orgId)
        const guardrails = await getGuardRailsForOrg(this.orgId)

        const completePrompt = 
`You are a helpful Developer Relations engineer from the ${this.orgName} team that helps users with the documentation & bugs they encounter.

When responding to queries, follow this thought process:
1. First, understand the type of query:
- Is it a bug report?
- Is it a documentation gap?
- Is it a feature request?
- Is it a general question about functionality?

2. For each query:
- Search the documentation thoroughly using the vector query tool
- If it's a bug, look for similar issues or known limitations
- If it's a documentation gap, identify the closest related content
- If it's a feature request, check if it exists or if there are workarounds

3. Structure your response:
- Acknowledge the specific type of query
- Share relevant documentation snippets
- If it's a bug, suggest potential solutions or workarounds
- If documentation is missing, explain what exists and what's missing
- If a feature doesn't exist, suggest alternatives or workarounds

4. Always:
- Be empathetic to the developer's situation
- Provide clear, actionable next steps
- Acknowledge limitations in your knowledge
- Suggest where to get more help if needed

Your DevRel Persona : ${orgPrompt}

Keep the following guardrails in mind : ${guardrails.join(", ")}

Previous Conversation: ${contextualQuery}

Only respond based on the the pointers shared, vector search results and in context to the ${this.orgName} documentation. If you can't find an answer, acknowledge it clearly. Keep responses short, helpful, and source-backed.`

        const [answer, success] = await getRagResponse(this.orgId, question, completePrompt)
        if (!success) {
            throw new Error("Failed to get a response from RAG");
        }

        await addMessageToConversation( conversation.id, answer, "assistant");
        await thread.send({content: answer,});
    } catch (error) {
        console.error("Error handling bot mention:", error);
        await message.reply( "Sorry, I encountered an error while processing your question.");
    }
  }

  private createThreadName(question: string): string {
    // Remove any markdown, URLs, and special characters
    let cleanQuestion = question
      .replace(/[#*_~`]/g, "") // Remove markdown
      .replace(/https?:\/\/\S+/g, "") // Remove URLs
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .trim();

    // Split into words and take first 5 words
    const words = cleanQuestion.split(/\s+/).slice(0, 5);

    // Join words and ensure it's not too long
    let threadName = words.join(" ");

    // If the name is too long, truncate it
    if (threadName.length > 100) {
      threadName = threadName.substring(0, 97) + "...";
    }

    // If the name is too short or empty, use a default
    if (threadName.length < 3) {
      threadName = "Question about " + this.orgName;
    }

    return threadName;
  }

  public async start(token: string) {
    await this.client.login(token);
  }

  public async stop() {
    await this.client.destroy();
  }
}
