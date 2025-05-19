import { Client, GatewayIntentBits, Message, ThreadChannel } from "discord.js";
import { initialiseDevRelAgent } from "../agent";
import { initialiseMastra } from "../mastra";
import {
  createConversation,
  addMessageToConversation,
  getConversationHistory,
} from "../db/conversations";

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

      // Create or get conversation
      const conversation = await createConversation(this.orgId); // see how to do on discord per thread basis

      // Add user message to history
      await addMessageToConversation(conversation.id, question, "user");

      // Get conversation history
      const history = await getConversationHistory(conversation.id);

      // Get response from the agent with context
      const devRelAgent = initialiseDevRelAgent(this.orgId, this.orgName);
      const mastra = initialiseMastra(devRelAgent);
      const agent = mastra.getAgent("devRelAgent");

      // Include conversation history in the prompt
      const contextualQuery = `
Previous conversation:
${history.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}

Current question:
${question}
`;

      const response = await agent.generate(contextualQuery);

      // Store assistant's response
      await addMessageToConversation(
        conversation.id,
        response.text,
        "assistant"
      );

      // Send the response
      await thread.send({
        content: response.text,
      });
    } catch (error) {
      console.error("Error handling bot mention:", error);
      await message.reply(
        "Sorry, I encountered an error while processing your question."
      );
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
