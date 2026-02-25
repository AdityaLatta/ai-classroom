import { PoolClient } from "pg";

// --- Service DTOs ---

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  isNewUser?: boolean;
}

export interface LoginWithGoogleDTO {
  idToken: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface RefreshTokenDTO {
  refreshToken: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

// --- Token Repository Types ---

export interface TokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

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

// --- Repository Interfaces ---

export type EmailVerificationToken = TokenRecord;

export type PasswordResetToken = TokenRecord;

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

export interface IEmailVerificationRepository {
  create(userId: string): Promise<string>;
  findValidByRawToken(rawToken: string): Promise<EmailVerificationToken | null>;
  markUsed(id: string, client?: PoolClient): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface IPasswordResetRepository {
  create(userId: string): Promise<string>;
  findValidByRawToken(rawToken: string): Promise<PasswordResetToken | null>;
  markUsed(id: string, client?: PoolClient): Promise<void>;
  deleteExpired(): Promise<number>;
}
