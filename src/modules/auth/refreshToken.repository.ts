import { z } from "zod";
import { Pool, PoolClient } from "pg";
import { getDb } from "../../infra/db";
import { getRefreshTokenExpiry } from "../../auth/jwt";

const refreshTokenRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  token_hash: z.string(),
  expires_at: z.coerce.date(),
  revoked: z.boolean(),
  device_info: z.string().nullable(),
  ip_address: z.string().nullable(),
  created_at: z.coerce.date(),
  last_used_at: z.coerce.date().nullable(),
});

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface CreateRefreshTokenDTO {
  userId: string;
  tokenHash: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface IRefreshTokenRepository {
  create(dto: CreateRefreshTokenDTO): Promise<RefreshToken>;
  findValidByHash(tokenHash: string): Promise<RefreshToken | null>;
  updateLastUsed(id: string): Promise<void>;
  revoke(id: string): Promise<void>;
  revokeByHash(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string, client?: PoolClient): Promise<void>;
  deleteExpired(): Promise<number>;
  getActiveSessionsForUser(userId: string): Promise<RefreshToken[]>;
}

const REFRESH_TOKEN_COLUMNS = "id, user_id, token_hash, expires_at, revoked, device_info, ip_address, created_at, last_used_at";

export class RefreshTokenRepository implements IRefreshTokenRepository {
  private query(client?: PoolClient): Pick<Pool, "query"> {
    return client || getDb();
  }

  async create(dto: CreateRefreshTokenDTO): Promise<RefreshToken> {
    const expiresAt = getRefreshTokenExpiry();

    const result = await this.query().query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info, ip_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${REFRESH_TOKEN_COLUMNS}`,
      [
        dto.userId,
        dto.tokenHash,
        expiresAt,
        dto.deviceInfo || null,
        dto.ipAddress || null,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.query().query(
      `SELECT ${REFRESH_TOKEN_COLUMNS} FROM refresh_tokens
       WHERE token_hash = $1
       AND revoked = false
       AND expires_at > NOW()`,
      [tokenHash],
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.query().query(
      `UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async revoke(id: string): Promise<void> {
    await this.query().query(
      `UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
      [id],
    );
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.query().query(
      `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeAllForUser(userId: string, client?: PoolClient): Promise<void> {
    await this.query(client).query(
      `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
      [userId],
    );
  }

  async deleteExpired(): Promise<number> {
    const result = await this.query().query(
      `DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id`,
    );
    return result.rowCount || 0;
  }

  async getActiveSessionsForUser(userId: string): Promise<RefreshToken[]> {
    const result = await this.query().query(
      `SELECT ${REFRESH_TOKEN_COLUMNS} FROM refresh_tokens
       WHERE user_id = $1
       AND revoked = false
       AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /** Maps a database row to a RefreshToken domain object. */
  private mapRow(row: Record<string, unknown>): RefreshToken {
    const parsed = refreshTokenRowSchema.parse(row);
    return {
      id: parsed.id,
      userId: parsed.user_id,
      tokenHash: parsed.token_hash,
      expiresAt: parsed.expires_at,
      revoked: parsed.revoked,
      deviceInfo: parsed.device_info,
      ipAddress: parsed.ip_address,
      createdAt: parsed.created_at,
      lastUsedAt: parsed.last_used_at,
    };
  }
}
