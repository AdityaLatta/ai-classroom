import { getDb } from "../../infra/db";
import { getRefreshTokenExpiry } from "../../auth/jwt";

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
  revokeAllForUser(userId: string): Promise<void>;
  deleteExpired(): Promise<number>;
  getActiveSessionsForUser(userId: string): Promise<RefreshToken[]>;
}

export class RefreshTokenRepository implements IRefreshTokenRepository {
  /**
   * Store a new refresh token
   */
  async create(dto: CreateRefreshTokenDTO): Promise<RefreshToken> {
    const db = getDb();
    const expiresAt = getRefreshTokenExpiry();

    const result = await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info, ip_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
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

  /**
   * Find a valid (non-expired, non-revoked) refresh token by its hash
   */
  async findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    const db = getDb();

    const result = await db.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1
       AND revoked = false
       AND expires_at > NOW()`,
      [tokenHash],
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Update last_used_at timestamp
   */
  async updateLastUsed(id: string): Promise<void> {
    const db = getDb();
    await db.query(
      `UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  /**
   * Revoke a specific refresh token
   */
  async revoke(id: string): Promise<void> {
    const db = getDb();
    await db.query(`UPDATE refresh_tokens SET revoked = true WHERE id = $1`, [
      id,
    ]);
  }

  /**
   * Revoke a token by its hash
   */
  async revokeByHash(tokenHash: string): Promise<void> {
    const db = getDb();
    await db.query(
      `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   */
  async revokeAllForUser(userId: string): Promise<void> {
    const db = getDb();
    await db.query(
      `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
      [userId],
    );
  }

  /**
   * Delete expired tokens (cleanup job)
   */
  async deleteExpired(): Promise<number> {
    const db = getDb();
    const result = await db.query(
      `DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id`,
    );
    return result.rowCount || 0;
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessionsForUser(userId: string): Promise<RefreshToken[]> {
    const db = getDb();
    const result = await db.query(
      `SELECT * FROM refresh_tokens
       WHERE user_id = $1
       AND revoked = false
       AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: Record<string, unknown>): RefreshToken {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      tokenHash: row.token_hash as string,
      expiresAt: row.expires_at as Date,
      revoked: row.revoked as boolean,
      deviceInfo: row.device_info as string | null,
      ipAddress: row.ip_address as string | null,
      createdAt: row.created_at as Date,
      lastUsedAt: row.last_used_at as Date | null,
    };
  }
}
