import { pool } from "./init";
import { v4 as uuidv4 } from "uuid";

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
  console.log("result conversations", result.rows);
  // for each conversation, get the messages
  const conversationsWithMessages = await Promise.all(
    result.rows.map(async (conversation) => {
      console.log("conversation", conversation);
      const messages = await getConversationHistory(conversation.id);
      console.log("messages", messages);
      return { ...conversation, messages };
    })
  );
  console.log("conversationsWithMessages", conversationsWithMessages);
  return conversationsWithMessages;
}

export async function getDashboardAnalyticsFromDb(orgId: string) {
  let totalQueries = 0; // number of messages asked by users
  let totalUsers = 0; // number of unique users
  let averageConversationLength = 0; // average number of messages per conversation
  const totalQueriesResult = await pool.query(
    "SELECT COUNT(*) FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE org_id = $1)",
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
