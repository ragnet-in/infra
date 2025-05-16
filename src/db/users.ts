import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { User, Repository } from "../types";

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

export async function initDb() {
  // Enable uuid-ossp extension
  await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);

  await pool.query(`CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    org_name VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);
}

export async function createUser(
  email: string,
  password: string
): Promise<User> {
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = uuidv4();

  const result = await pool.query(
    "INSERT INTO users (id, email, password) VALUES ($1, $2, $3) RETURNING *",
    [id, email, hashedPassword]
  );

  return result.rows[0];
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function createRepository(
  userId: string,
  name: string,
  orgName: string,
  repoName: string
): Promise<Repository> {
  const id = uuidv4();

  const result = await pool.query(
    "INSERT INTO repositories (id, name, org_name, repo_name, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [id, name, orgName, repoName, userId]
  );

  return result.rows[0];
}

export async function getRepositoryById(
  id: string
): Promise<Repository | null> {
  const result = await pool.query("SELECT * FROM repositories WHERE id = $1", [
    id,
  ]);
  return result.rows[0] || null;
}
