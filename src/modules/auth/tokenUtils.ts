import crypto from "crypto";
import { Pool, PoolClient } from "pg";
import { withTransaction } from "@/infra/db";

interface CreateHashedTokenOptions {
  tableName: string;
  userId: string;
  expiryMs: number;
  client?: PoolClient;
}

/**
 * Shared utility for the generate-hash-invalidate-insert pattern
 * used by email verification and password reset tokens.
 * Wraps invalidate + insert in a transaction to prevent race conditions.
 */
export async function createHashedToken(options: CreateHashedTokenOptions): Promise<string> {
  const { tableName, userId, expiryMs, client } = options;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + expiryMs);

  const execute = async (db: Pick<Pool, "query">) => {
    // Invalidate any existing unused tokens for this user
    await db.query(
      `UPDATE ${tableName} SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );

    await db.query(
      `INSERT INTO ${tableName} (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  };

  if (client) {
    await execute(client);
  } else {
    await withTransaction((txClient) => execute(txClient));
  }

  return rawToken;
}
