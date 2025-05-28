import { Pool } from 'pg'; 

export const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection on startup
pool.on('connect', async (client) => {
  try {
    await client.query('SELECT 1');
  } catch (error) {
    console.error('Database connection test failed', error);
    process.exit(1);
  }
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  getClient: () => pool.connect(),
  close: () => pool.end(),
};