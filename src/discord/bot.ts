import { Client, GatewayIntentBits, Message, ThreadChannel } from "discord.js";
import { initialiseDevRelAgent } from "../agent";
import { initialiseMastra } from "../mastra";

export class DiscordBot {
  private client: Client;
  private orgName: string;
  private repoName: string;

  constructor(orgName: string, repoName: string) {
    this.orgName = orgName;
    this.repoName = repoName;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

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
      // Remove the bot mention and clean up the question
      const question = message.content.replace(/<@!\d+>/g, "").trim();

      // Create a better thread name
      const threadName = this.createThreadName(question);

      // Create a new thread from the message
      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: 60, // Archive after 1 hour
      });

      // Get response from the agent
      const devRelAgent = initialiseDevRelAgent(this.orgName, this.repoName);
      const mastra = initialiseMastra(devRelAgent);
      const agent = mastra.getAgent("devRelAgent");
      const response = await agent.generate(question);

      // Send the response in the thread
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
      threadName = "Question about " + this.repoName;
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
