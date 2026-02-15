import { PoolClient } from "pg";
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
  updatePasswordHash(userId: string, passwordHash: string, client?: PoolClient): Promise<void>;
  markEmailVerified(userId: string, client?: PoolClient): Promise<void>;
}
