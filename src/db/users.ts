import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { User } from "./types";
import { pool } from "./init";

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

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0] || null;
}

export async function isPasswordMatch(
  email: string,
  password: string
): Promise<boolean> {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  const isPasswordMatch = await bcrypt.compare(
    password,
    result.rows[0].password
  );
  return isPasswordMatch;
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}
