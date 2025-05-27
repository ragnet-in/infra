import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

export async function initDb() {
  try {
    // Enable required extensions
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "vector";');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create organizations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_organizations junction table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_organizations (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, org_id)
      );
    `);

    // Create sources table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(255) NOT NULL,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Conversation History table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        anonymous_id VARCHAR(255),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Conversation Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );    
    `);

    // Create org_preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS org_preferences (
        org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        guardrails TEXT[],
        org_prompt TEXT
      );
    `);
    
    // Create api keys tabls
    await pool.query(`
      CREATE TABLE IF NOT EXISTS org_api_keys (
        org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        api_key VARCHAR(255) NOT NULL
      );
    `);
    
    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON user_organizations(org_id);
      CREATE INDEX IF NOT EXISTS idx_sources_org_id ON sources(org_id);
    `);

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

// Export pool for use in other files
export { pool };
