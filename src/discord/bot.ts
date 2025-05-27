import { Client, GatewayIntentBits, Message, ThreadChannel } from "discord.js";
import {
  createConversation,
  addMessageToConversation,
  getConversationHistory,
} from "../db/conversations";
import {getPromptForOrg} from "../db/preferences"

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

      const orgPrompt = await getPromptForOrg(this.orgId)
      // // Get response from the agent with context
      // const devRelAgent = initialiseDevRelAgent(this.orgId, this.orgName, orgPrompt||"");
      // const mastra = initialiseMastra(devRelAgent);
      // const agent = mastra.getAgent("devRelAgent");

      // Include conversation history in the prompt
      const contextualQuery = `
Previous conversation:
${history.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}

Current question:
${question}
`;

      // const response = await agent.generate(contextualQuery);

      // Store assistant's response
      await addMessageToConversation(
        conversation.id,
        // response.text,
        "discord output",
        "assistant"
      );

      // Send the response
      await thread.send({
        content: "discord output",
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

export async function loadDataFromDiscord(guildId: string, orgId: string) {
}
// import {
//   Client,
//   GatewayIntentBits,
//   TextChannel,
//   Collection,
//   Message,
// } from "discord.js";
// import { config } from "dotenv";
// import { generateChunks, saveChunksToCsv, fetchFromGitHub } from "./fetcher";
// import { generateEmbeddings } from "./ai";
// import { fetchFromDiscord } from "./discordFetcher";
// config();


// export async function fetchFromDiscord(guildId: string) {
//   console.log(`Fetching from Discord: Guild ${guildId}`);

//   const client = new Client({
//     intents: [
//       GatewayIntentBits.Guilds,
//       GatewayIntentBits.GuildMessages,
//       GatewayIntentBits.MessageContent,
//     ],
//   });

//   const pages = new Map<string, string>();

//   await new Promise<void>((resolve) => {
//     client.once("ready", async () => {
//       try {
//         const guild = await client.guilds.fetch(guildId);
//         const channels = await guild.channels.fetch();

//         for (const [_, channel] of channels) {
//           if (channel?.isTextBased() && channel instanceof TextChannel) {
//             const messages = await fetchChannelMessages(channel);

//             // Group messages by day
//             const messagesByDay = new Map<string, string[]>();

//             messages.forEach((msg) => {
//               const date = msg.createdAt.toISOString().split("T")[0];
//               if (!messagesByDay.has(date)) {
//                 messagesByDay.set(date, []);
//               }
//               messagesByDay
//                 .get(date)
//                 ?.push(
//                   `[${msg.createdAt.toISOString()}] ${msg.author.username}: ${
//                     msg.content
//                   }`
//                 );
//             });

//             // Create pages for each day
//             messagesByDay.forEach((messages, date) => {
//               const key = `discord/${channel.name}/${date}`;
//               pages.set(key, messages.join("\n"));
//             });
//           }
//         }
//       } catch (error) {
//         console.error("Error fetching Discord messages:", error);
//       } finally {
//         await client.destroy();
//         resolve();
//       }
//     });

//     client.login(process.env.DISCORD_BOT_TOKEN);
//   });

//   console.log(`Found ${pages.size} conversation chunks`);
//   return pages;
// }

// async function fetchChannelMessages(
//   channel: TextChannel
// ): Promise<Collection<string, Message>> {
//   let allMessages = new Collection<string, Message>();
//   let lastId: string | undefined;

//   while (true) {
//     const options: any = { limit: 100 };
//     if (lastId) options.before = lastId;

//     const messages = await channel.messages.fetch(options);
//     if ((messages as any).size === 0) break;

//     allMessages = allMessages.concat(messages as any);
//     lastId = (messages as any).last()?.id;

//     // Add a small delay to avoid rate limits
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//   }

//   return allMessages;
// }

// export async function loadDataFromDiscord(guildId: string, orgId: string) {
//   // Fetch all Discord messages
//   const pages = await fetchFromDiscord(guildId);

//   // Process each page
//   const allChunks = await generateChunks(pages);

//   // Create CSV content
//   saveChunksToCsv(allChunks, getIndexName(orgId));

//   // Generate embeddings
//   const embeddings = await generateEmbeddings(allChunks);

//   const vectorStore = createVectorStore(mastra);

//   // Create an index for our docs chunks
//   await createIndex(vectorStore, getIndexName(orgId));

//   // Store embeddings
//   await upsert(
//     vectorStore,
//     getIndexName(orgId),
//     embeddings,
//     allChunks.map((chunk) => ({
//       text: chunk.text,
//       source: chunk.source,
//     }))
//   );
// }

