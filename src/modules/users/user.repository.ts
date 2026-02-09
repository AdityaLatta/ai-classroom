// src/modules/users/user.repository.ts
import { getDb } from "../../infra/db";
import { UserRole } from "../../auth/jwt";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string | null;
  emailVerified: boolean;
  authProvider: "google" | "email";
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  role?: UserRole;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findOrCreate(data: CreateUserDTO): Promise<User>;
  update(id: string, data: Partial<Pick<User, "name" | "role">>): Promise<User | null>;
  createWithPassword(data: { email: string; name: string; passwordHash: string }): Promise<User>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  markEmailVerified(userId: string): Promise<void>;
}

export class UserRepository implements IUserRepository {
  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const db = getDb();
    const result = await db.query(`SELECT * FROM users WHERE id = $1`, [id]);

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const db = getDb();
    const result = await db.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);

    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find or create user (for OAuth flows)
   */
  async findOrCreate(data: CreateUserDTO): Promise<User> {
    const db = getDb();
    const role = data.role || "STUDENT";

    const result = await db.query(
      `INSERT INTO users (email, name, role, email_verified, auth_provider)
       VALUES ($1, $2, $3, true, 'google')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING *`,
      [data.email, data.name, role],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Update user profile
   */
  async update(
    id: string,
    data: Partial<Pick<User, "name" | "role">>,
  ): Promise<User | null> {
    const db = getDb();
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
    const result = await db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
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
    const db = getDb();
    const result = await db.query(
      `INSERT INTO users (email, name, password_hash, email_verified, auth_provider)
       VALUES ($1, $2, $3, false, 'email')
       RETURNING *`,
      [data.email, data.name, data.passwordHash],
    );
    return this.mapRow(result.rows[0]);
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    const db = getDb();
    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      userId,
    ]);
  }

  async markEmailVerified(userId: string): Promise<void> {
    const db = getDb();
    await db.query(`UPDATE users SET email_verified = true WHERE id = $1`, [
      userId,
    ]);
  }

  private mapRow(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      role: row.role as UserRole,
      passwordHash: (row.password_hash as string) || null,
      emailVerified: row.email_verified as boolean,
      authProvider: row.auth_provider as "google" | "email",
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}
