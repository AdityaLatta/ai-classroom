// pg Pool is used for runtime queries. Knex is used only for migrations (knexfile.ts).
import { Pool, PoolClient } from "pg";
import { getEnv } from "../config/env";
import { logger } from "../utils/logger";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    throw new Error("Database not initialized");
  }
  return pool;
}

export async function initDb() {
  const {
    DATABASE_URL,
    DB_POOL_MAX,
    DB_POOL_IDLE_TIMEOUT_MS,
    DB_POOL_CONNECTION_TIMEOUT_MS,
    DB_SSL,
  } = getEnv();

  const requiresSsl = DB_SSL || DATABASE_URL.includes("sslmode=");

  pool = new Pool({
    connectionString: DATABASE_URL,
    max: DB_POOL_MAX,
    idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  });

  pool.on("error", (err) => {
    logger.error({ err }, "Unexpected database pool error");
  });

  await pool.query("SELECT 1");
  logger.info("Database connected");
}

export async function healthCheck(): Promise<boolean> {
  try {
    const db = getDb();
    await db.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ err: error }, "Transaction rolled back");
    throw error;
  } finally {
    client.release();
  }
}

export async function withClient<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const client = await db.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info("Database connection closed");
  }
}
