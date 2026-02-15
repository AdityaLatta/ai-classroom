import { z } from "zod";
import { Pool, PoolClient } from "pg";
import { getDb } from "../../infra/db";
import { User, CreateUserDTO, IUserRepository } from "./user.types";

const userRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]),
  password_hash: z.string().nullable(),
  email_verified: z.boolean(),
  auth_provider: z.enum(["google", "email"]),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const USER_COLUMNS = "id, email, name, role, password_hash, email_verified, auth_provider, created_at, updated_at";

export class UserRepository implements IUserRepository {
  private query(client?: PoolClient): Pick<Pool, "query"> {
    return client || getDb();
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.query().query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query().query(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
      [email],
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findOrCreate(data: CreateUserDTO): Promise<User> {
    const role = data.role || "STUDENT";

    // Use INSERT ... ON CONFLICT to handle race conditions atomically.
    // Only update name on conflict (not role or other fields) to avoid overwriting.
    const result = await this.query().query(
      `INSERT INTO users (email, name, role, email_verified, auth_provider)
       VALUES ($1, $2, $3, true, 'google')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING ${USER_COLUMNS}`,
      [data.email, data.name, role],
    );

    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    data: Partial<Pick<User, "name" | "role">>,
  ): Promise<User | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await this.query().query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING ${USER_COLUMNS}`,
      values,
    );

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async createWithPassword(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    const result = await this.query().query(
      `INSERT INTO users (email, name, password_hash, email_verified, auth_provider)
       VALUES ($1, $2, $3, false, 'email')
       RETURNING ${USER_COLUMNS}`,
      [data.email, data.name, data.passwordHash],
    );
    return this.mapRow(result.rows[0]);
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
    client?: PoolClient,
  ): Promise<void> {
    await this.query(client).query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [passwordHash, userId],
    );
  }

  async markEmailVerified(userId: string, client?: PoolClient): Promise<void> {
    await this.query(client).query(
      `UPDATE users SET email_verified = true WHERE id = $1`,
      [userId],
    );
  }

  /** Maps a database row to a User domain object. */
  private mapRow(row: Record<string, unknown>): User {
    const parsed = userRowSchema.parse(row);
    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      passwordHash: parsed.password_hash,
      emailVerified: parsed.email_verified,
      authProvider: parsed.auth_provider,
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
    };
  }
}
