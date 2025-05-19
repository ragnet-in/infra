import {
  Client,
  GatewayIntentBits,
  TextChannel,
  Collection,
  Message,
} from "discord.js";

export async function fetchFromDiscord(guildId: string) {
  console.log(`Fetching from Discord: Guild ${guildId}`);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const pages = new Map<string, string>();

  await new Promise<void>((resolve) => {
    client.once("ready", async () => {
      try {
        const guild = await client.guilds.fetch(guildId);
        const channels = await guild.channels.fetch();

        for (const [_, channel] of channels) {
          if (channel?.isTextBased() && channel instanceof TextChannel) {
            const messages = await fetchChannelMessages(channel);

            // Group messages by day
            const messagesByDay = new Map<string, string[]>();

            messages.forEach((msg) => {
              const date = msg.createdAt.toISOString().split("T")[0];
              if (!messagesByDay.has(date)) {
                messagesByDay.set(date, []);
              }
              messagesByDay
                .get(date)
                ?.push(
                  `[${msg.createdAt.toISOString()}] ${msg.author.username}: ${
                    msg.content
                  }`
                );
            });

            // Create pages for each day
            messagesByDay.forEach((messages, date) => {
              const key = `discord/${channel.name}/${date}`;
              pages.set(key, messages.join("\n"));
            });
          }
        }
      } catch (error) {
        console.error("Error fetching Discord messages:", error);
      } finally {
        await client.destroy();
        resolve();
      }
    });

    client.login(process.env.DISCORD_BOT_TOKEN);
  });

  console.log(`Found ${pages.size} conversation chunks`);
  return pages;
}

async function fetchChannelMessages(
  channel: TextChannel
): Promise<Collection<string, Message>> {
  let allMessages = new Collection<string, Message>();
  let lastId: string | undefined;

  while (true) {
    const options: any = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if ((messages as any).size === 0) break;

    allMessages = allMessages.concat(messages as any);
    lastId = (messages as any).last()?.id;

    // Add a small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return allMessages;
}
