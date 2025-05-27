import { pool } from "./init";
import { Organization} from "./types";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";

// Organization functions
export async function createOrgInDb(
  userId: string,
  name: string,
  description: string
): Promise<Organization> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orgId = uuidv4();
    const orgResult = await client.query(
      "INSERT INTO organizations (id, name, description) VALUES ($1, $2, $3) RETURNING *",
      [orgId, name, description]
    );

    await client.query(
      "INSERT INTO user_organizations (user_id, org_id) VALUES ($1, $2)",
      [userId, orgId]
    );

    await client.query("COMMIT");
    return orgResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrganizationById(
  orgId: string
): Promise<Organization> {
  const result = await pool.query("SELECT * FROM organizations WHERE id = $1", [
    orgId,
  ]);
  return result.rows[0];
}

export async function getUserOrganizations(
  userId: string
): Promise<Organization[]> {
  const result = await pool.query(
    `SELECT o.* FROM organizations o
       JOIN user_organizations uo ON o.id = uo.org_id
       WHERE uo.user_id = $1`,
    [userId]
  );
  return result.rows;
}

export async function isOrgOwner(
  orgId: string,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    "SELECT COUNT(*) FROM user_organizations WHERE org_id = $1 AND user_id = $2",
    [orgId, userId]
  );
  return result.rows[0].count === "1";
}

export async function generateAPIKeyForOrg(
  orgId: string
): Promise<string> {
  const apiKey = "ragnet_"+uuidv4();
  const hashedAPIKey = await bcrypt.hash(apiKey, 10);
  
  await pool.query(
    "INSERT INTO api_keys (org_id, key) VALUES ($1, $2)",
    [orgId, hashedAPIKey]
  );
  return apiKey;
}

export async function deleteAPIKeyForOrg(
  apiKey: string
): Promise<boolean> {
  try {
    const hashedAPIKey = await bcrypt.hash(apiKey, 10);
    await pool.query(
      "DELETE FROM api_keys WHERE key = $1",
      [hashedAPIKey]
    );
    return true;
  } catch (error) {
    return false;
  }
}

export async function addUserToOrg(
  userId: string,
  orgId: string, 
): Promise<boolean> {
  try {
    await pool.query(
      "INSERT INTO user_organizations (user_id, org_id) VALUES ($1, $2)",
      [userId, orgId]
    );
    return true;
  } catch (error) {
    return false;
  }
}