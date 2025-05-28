import { pool } from "./init";
import { v4 as uuidv4 } from "uuid";
import { getRagInsights } from "../rag"

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: Date;
}

export interface Conversation {
  id: string;
  user_id?: string;
  anonymous_id?: string;
  messages: Message[];
  created_at: Date;
}

export async function createConversation(
  orgId: string,
  userId?: string
): Promise<Conversation> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const conversationId = uuidv4();
    const anonymousId = !userId ? uuidv4() : null;

    const result = await client.query(
      "INSERT INTO conversations (id, user_id, anonymous_id, org_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [conversationId, userId, anonymousId, orgId]
    );

    await client.query("COMMIT");
    return {
      ...result.rows[0],
      messages: [],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function addMessageToConversation(
  conversationId: string,
  content: string,
  role: "user" | "assistant"
): Promise<Message> {
  const result = await pool.query(
    "INSERT INTO messages (id, conversation_id, content, role) VALUES ($1, $2, $3, $4) RETURNING *",
    [uuidv4(), conversationId, content, role]
  );
  return result.rows[0];
}

export async function getConversationHistory(
  conversationId: string,
  limit: number = 10
): Promise<Message[]> {
  const result = await pool.query(
    "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2",
    [conversationId, limit]
  );
  return result.rows;
}

export async function getConversationById(
  conversationId: string
): Promise<Conversation> {
  const result = await pool.query("SELECT * FROM conversations WHERE id = $1", [
    conversationId,
  ]);
  return result.rows[0];
}

export async function getConversationsFromOrganization(
  organizationId: string
): Promise<Conversation[]> {
  const result = await pool.query(
    "SELECT * FROM conversations WHERE org_id = $1",
    [organizationId]
  );
  // for each conversation, get the messages
  const conversationsWithMessages = await Promise.all(
    result.rows.map(async (conversation) => {
      const messages = await getConversationHistory(conversation.id);
      return { ...conversation, messages };
    })
  );
  return conversationsWithMessages;
}

export async function getDashboardAnalyticsFromDb(orgId: string) {
  let totalQueries = 0; // number of messages asked by users
  let totalUsers = 0; // number of unique users
  let averageConversationLength = 0; // average number of messages per conversation
  const totalQueriesResult = await pool.query(
    "SELECT COUNT(*) FROM messages WHERE role = 'assistant' AND conversation_id IN (SELECT id FROM conversations WHERE org_id = $1)",
    [orgId]
  );
  totalQueries = totalQueriesResult.rows[0].count;

  const totalUsersResult = await pool.query(
    "SELECT COUNT(DISTINCT COALESCE(user_id::TEXT, anonymous_id)) FROM conversations WHERE org_id = $1",
    [orgId]
  );
  totalUsers = totalUsersResult.rows[0].count;

  const conversationsResult = await pool.query(
    "SELECT id FROM conversations WHERE org_id = $1",
    [orgId]
  );

  const messageCounts = await Promise.all(
    conversationsResult.rows.map(async (conversation) => {
      const countResult = await pool.query(
        "SELECT COUNT(*) FROM messages WHERE conversation_id = $1",
        [conversation.id]
      );
      return parseInt(countResult.rows[0].count);
    })
  );

  averageConversationLength =
    messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length || 0;
  return { totalQueries, totalUsers, averageConversationLength };
}

export async function getOrgAnalytics(orgId: string) {
  try {
    // Query total assistant messages
    const assistantCountRes = await pool.query(
      `SELECT COUNT(*) FROM messages 
       WHERE role = 'assistant' 
       AND conversation_id IN (
         SELECT id FROM conversations WHERE org_id = $1
       )`,
      [orgId]
    );
    const totalAssistantMessages = parseInt(assistantCountRes.rows[0].count);

    // Query total conversations
    const convoCountRes = await pool.query(
      `SELECT COUNT(*) FROM conversations WHERE org_id = $1`,
      [orgId]
    );
    const totalConversations = parseInt(convoCountRes.rows[0].count);

    // Fetch all conversation queries and responses with optional sources
    const convoDataRes = await pool.query(
      `SELECT c.id as conversation_id, m.role, m.content
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.org_id = $1
       ORDER BY c.created_at, m.created_at`,
      [orgId]
    );
    const convoMessages = convoDataRes.rows;

    // Structure messages as conversations
    const conversationMap = new Map();
    convoMessages.forEach(({ conversation_id, role, content }) => {
      if (!conversationMap.has(conversation_id)) {
        conversationMap.set(conversation_id, []);
      }
      conversationMap.get(conversation_id).push({ role, content });
    });

    const formattedConversationText = [...conversationMap.entries()].map(
    ([id, messages]: [string, { role: string; content: string }[]]) => {
      return `Conversation ID: ${id}\n` +
        messages.map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    }
    ).join("\n\n---\n\n");

    const insights = await getRagInsights(orgId, formattedConversationText);
    return {
      totalAssistantMessages,
      totalConversations,
      averageConversationLength: 0,
      insights: insights || "No insights generated"
    };
  } catch (error) {
    console.error("Failed to generate org analytics:", error);
    throw error;
  }
}