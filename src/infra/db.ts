// pg Pool is used for runtime queries. Knex is used only for migrations (knexfile.ts).
import { Pool, PoolClient } from "pg";
import { getEnv } from "@/config";
import { logger } from "@/utils";
import { instrumentPool, instrumentClient } from "./instrumentedPool";

let pool: Pool | null = null;

const MAX_RETRIES = 5;
const RETRY_BASE_MS = 1000;

export function getDb(): Pool {
  if (!pool) {
    throw new Error("Database not initialized");
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const {
    DATABASE_URL,
    DB_POOL_MAX,
    DB_POOL_IDLE_TIMEOUT_MS,
    DB_POOL_CONNECTION_TIMEOUT_MS,
    DB_SSL,
    DB_SSL_CA,
  } = getEnv();

  const requiresSsl = DB_SSL || DATABASE_URL.includes("sslmode=");

  let sslConfig: { rejectUnauthorized: boolean; ca?: string } | undefined;
  if (requiresSsl) {
    sslConfig = {
      rejectUnauthorized: !!DB_SSL_CA,
      ...(DB_SSL_CA ? { ca: DB_SSL_CA } : {}),
    };
  }

  pool = new Pool({
    connectionString: DATABASE_URL,
    max: DB_POOL_MAX,
    idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
    ssl: sslConfig,
    // Keepalive: detect dead connections from cloud providers (Aiven, RDS, etc.)
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  instrumentPool(pool);

  pool.on("error", (err) => {
    logger.error({ err }, "Unexpected database pool error");
  });

  // Retry connection with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await pool.query("SELECT 1");
      logger.info("Database connected");
      return;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        logger.fatal({ err, attempt }, "Database connection failed after all retries");
        throw err;
      }
      const delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      logger.warn({ err, attempt, nextRetryMs: delayMs }, "Database connection failed, retrying...");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
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
  instrumentClient(client);

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr }, "Rollback failed");
    }
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
  instrumentClient(client);

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
