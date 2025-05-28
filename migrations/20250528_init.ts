import { db } from '../dist/database/client.js';

export const up = async () => {
  // Enable extensions
  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await db.query('CREATE EXTENSION IF NOT EXISTS "vector"');

  // Create tables
  await db.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE user_organizations (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, org_id)
    )
  `);

  await db.query(`
    CREATE TABLE sources (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(255) NOT NULL,
      last_sync_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE conversations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      anonymous_id VARCHAR(255),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE org_preferences (
      org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      guardrails TEXT[],
      org_prompt TEXT
    )
  `);

  await db.query(`
    CREATE TABLE org_api_keys (
      org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      api_key VARCHAR(255) NOT NULL
    )
  `);

  // Create indexes
  await db.query(`
    CREATE INDEX idx_user_organizations_user_id ON user_organizations(user_id)
  `);
  await db.query(`
    CREATE INDEX idx_user_organizations_org_id ON user_organizations(org_id)
  `);
  await db.query(`
    CREATE INDEX idx_sources_org_id ON sources(org_id)
  `);
};

export const down = async () => {
  // Drop tables in reverse order of creation
  await db.query('DROP TABLE IF EXISTS org_api_keys CASCADE');
  await db.query('DROP TABLE IF EXISTS org_preferences CASCADE');
  await db.query('DROP TABLE IF EXISTS messages CASCADE');
  await db.query('DROP TABLE IF EXISTS conversations CASCADE');
  await db.query('DROP TABLE IF EXISTS sources CASCADE');
  await db.query('DROP TABLE IF EXISTS user_organizations CASCADE');
  await db.query('DROP TABLE IF EXISTS organizations CASCADE');
  await db.query('DROP TABLE IF EXISTS users CASCADE');
  
  // Drop extensions
  await db.query('DROP EXTENSION IF EXISTS "vector"');
  await db.query('DROP EXTENSION IF EXISTS "uuid-ossp"');
};

export default { up, down };