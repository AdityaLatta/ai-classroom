import crypto from "crypto";
import { z } from "zod";
import { Pool, PoolClient } from "pg";
import { getDb } from "../../infra/db";
import { createHashedToken } from "./tokenUtils";
import { TokenRecord } from "./auth.types";

const tokenRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  token_hash: z.string(),
  expires_at: z.coerce.date(),
  used_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
});

export abstract class BaseTokenRepository {
  constructor(
    protected readonly tableName: string,
    protected readonly expiryMs: number,
  ) {}

  protected query(client?: PoolClient): Pick<Pool, "query"> {
    return client || getDb();
  }

  async create(userId: string): Promise<string> {
    return createHashedToken({
      tableName: this.tableName,
      userId,
      expiryMs: this.expiryMs,
    });
  }

  async findValidByRawToken(rawToken: string): Promise<TokenRecord | null> {
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const result = await this.query().query(
      `SELECT id, user_id, token_hash, expires_at, used_at, created_at
       FROM ${this.tableName}
       WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()`,
      [tokenHash],
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async markUsed(id: string, client?: PoolClient): Promise<void> {
    await this.query(client).query(
      `UPDATE ${this.tableName} SET used_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async deleteExpired(): Promise<number> {
    const result = await this.query().query(
      `DELETE FROM ${this.tableName} WHERE expires_at < NOW() RETURNING id`,
    );
    return result.rowCount || 0;
  }

  protected mapRow(row: Record<string, unknown>): TokenRecord {
    const parsed = tokenRowSchema.parse(row);
    return {
      id: parsed.id,
      userId: parsed.user_id,
      tokenHash: parsed.token_hash,
      expiresAt: parsed.expires_at,
      usedAt: parsed.used_at,
      createdAt: parsed.created_at,
    };
  }
}
