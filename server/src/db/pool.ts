import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Discrete configuration avoids URL-encoding bugs with special characters in passwords (like '+', '%', '@')
const poolConfig: pg.PoolConfig = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
} else {
  poolConfig.host = config.database.host;
  poolConfig.port = config.database.port;
  poolConfig.user = config.database.user;
  poolConfig.password = config.database.password;
  poolConfig.database = config.database.name;
}

if (process.env.DATABASE_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Get a client from the pool for transactional use.
 */
export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

/**
 * Execute a single query with parameterised values and automatic retry for initial startup connections.
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  let retries = 3;
  while (retries > 0) {
    try {
      return await pool.query<T>(text, params);
    } catch (err: any) {
      retries--;
      if (retries === 0 || !err.message?.includes('Connection')) {
        throw err;
      }
      console.warn(`[DB] Query failed (${err.message}). Retrying in 2s... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return pool.query<T>(text, params);
}

export default pool;