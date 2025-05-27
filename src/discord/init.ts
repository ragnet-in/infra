import { DiscordBot } from "./bot";
import { pool } from "../db/init";

export const initDiscord = async () => {
  try {
    // Get all Discord sources from the database
    // const result = await pool.query(`
    //   SELECT s.*, o.name as org_name 
    //   FROM sources s 
    //   JOIN organizations o ON s.org_id = o.id 
    //   WHERE s.type = 'discord'
    // `);
    // type has been removed, need to check if still needed
    const result = await pool.query(`
      SELECT s.*, o.name as org_name 
      FROM sources s 
      JOIN organizations o ON s.org_id = o.id 
    `);

    // Initialize bot for each source
    for (const source of result.rows) {
      const bot = new DiscordBot(source.org_id, source.org_name);
      await bot.start(process.env.DISCORD_BOT_TOKEN!);
      console.log(`Bot initialized for ${source.name} (${source.org_id})`);
    }
  } catch (error) {
    console.error("Failed to initialize Discord bots:", error);
  }
};
