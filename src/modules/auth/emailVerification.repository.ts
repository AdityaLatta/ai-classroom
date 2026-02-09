import crypto from "crypto";
import { getDb } from "../../infra/db";

export interface EmailVerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IEmailVerificationRepository {
  create(userId: string): Promise<string>;
  findValidByRawToken(rawToken: string): Promise<EmailVerificationToken | null>;
  markUsed(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export class EmailVerificationRepository implements IEmailVerificationRepository {
  async create(userId: string): Promise<string> {
    const db = getDb();
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate any existing unused tokens for this user
    await db.query(
      `UPDATE email_verification_tokens SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );

    await db.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );

    return rawToken;
  }

  async findValidByRawToken(
    rawToken: string,
  ): Promise<EmailVerificationToken | null> {
    const db = getDb();
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const result = await db.query(
      `SELECT * FROM email_verification_tokens
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
      `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async deleteExpired(): Promise<number> {
    const db = getDb();
    const result = await db.query(
      `DELETE FROM email_verification_tokens WHERE expires_at < NOW() RETURNING id`,
    );
    return result.rowCount || 0;
  }

  private mapRow(row: Record<string, unknown>): EmailVerificationToken {
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
