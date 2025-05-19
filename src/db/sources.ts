import { SourceConfig, Source } from "./types";
import { v4 as uuidv4 } from "uuid";
import { pool } from "./init";

// Source functions
export async function createSourceInDb(
  orgId: string,
  name: string,
  type: string,
  config: SourceConfig,
  lastSyncAt?: Date
): Promise<Source> {
  // First check if organization exists
  const orgCheck = await pool.query(
    "SELECT id FROM organizations WHERE id = $1",
    [orgId]
  );

  if (orgCheck.rows.length === 0) {
    throw new Error(`Organization with id ${orgId} does not exist`);
  }

  const id = uuidv4();
  const result = await pool.query(
    "INSERT INTO sources (id, org_id, name, type, config, last_sync_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [id, orgId, name, type, JSON.stringify(config), lastSyncAt]
  );
  return result.rows[0];
}

export async function getOrganizationSources(orgId: string): Promise<Source[]> {
  console.log("orgId inside getOrganizationSources", orgId);
  const result = await pool.query("SELECT * FROM sources WHERE org_id = $1", [
    orgId,
  ]);
  console.log("result", result.rows);
  return result.rows;
}

export async function getSourceById(sourceId: string): Promise<Source> {
  const result = await pool.query("SELECT * FROM sources WHERE id = $1", [
    sourceId,
  ]);
  return result.rows[0];
}
