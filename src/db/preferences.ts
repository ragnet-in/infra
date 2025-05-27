import { pool } from "./init";

// guardrails for an org by merging with the existing array.
export async function addGuardRailsForOrg(orgId: string, words: string[]) {
  if (!Array.isArray(words) || words.length === 0) return;

  await pool.query(
    `
    INSERT INTO org_preferences (org_id, guardrails)
    VALUES ($1, $2)
    ON CONFLICT (org_id)
    DO UPDATE SET guardrails = array(
      SELECT DISTINCT unnest(org_preferences.guardrails || EXCLUDED.guardrails)
    )
    `,
    [orgId, words]
  );
}

// Retrieves the guardrail array for the given org.
export async function getGuardRailsForOrg(orgId: string): Promise<string[]> {
  const result = await pool.query(
    "SELECT guardrails FROM org_preferences WHERE org_id = $1",
    [orgId]
  );
  return result.rows[0]?.guardrails || [];
}

// Sets the org-level custom prompt.
export async function addPromptForOrg(orgId: string, prompt: string) {
  await pool.query(
    `
    INSERT INTO org_preferences (org_id, org_prompt)
    VALUES ($1, $2)
    ON CONFLICT (org_id)
    DO UPDATE SET org_prompt = EXCLUDED.org_prompt;
    `,
    [orgId, prompt]
  );
}


// Retrieves the org-level custom prompt.
export async function getPromptForOrg(orgId: string): Promise<string | null> {
  const result = await pool.query(
    "SELECT org_prompt FROM org_preferences WHERE org_id = $1",
    [orgId]
  );
  return result.rows[0]?.org_prompt || null;
}