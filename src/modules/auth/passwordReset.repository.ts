import crypto from "crypto";
import { getDb } from "../../infra/db";

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IPasswordResetRepository {
  create(userId: string): Promise<string>;
  findValidByRawToken(rawToken: string): Promise<PasswordResetToken | null>;
  markUsed(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export class PasswordResetRepository implements IPasswordResetRepository {
  async create(userId: string): Promise<string> {
    const db = getDb();
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing unused tokens for this user
    await db.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );

    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );

    return rawToken;
  }

  async findValidByRawToken(
    rawToken: string,
  ): Promise<PasswordResetToken | null> {
    const db = getDb();
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const result = await db.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()`,
      [tokenHash],
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async markUsed(id: string): Promise<void> {
    const db = getDb();
    await db.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async deleteExpired(): Promise<number> {
    const db = getDb();
    const result = await db.query(
      `DELETE FROM password_reset_tokens WHERE expires_at < NOW() RETURNING id`,
    );
    return result.rowCount || 0;
  }

  private mapRow(row: Record<string, unknown>): PasswordResetToken {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      tokenHash: row.token_hash as string,
      expiresAt: row.expires_at as Date,
      usedAt: row.used_at as Date | null,
      createdAt: row.created_at as Date,
    };
  }
}
