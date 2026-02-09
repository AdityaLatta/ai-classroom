// src/auth/jwt.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getEnv } from "../config/env";
import { UserRole } from "../types/user";

export { UserRole };

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

// Access token expires in 15 minutes
const ACCESS_TOKEN_EXPIRY = "15m";
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;

// Refresh token expires in 7 days
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Sign an access token (short-lived)
 */
export function signAccessToken(payload: JwtPayload): string {
  const { JWT_SECRET } = getEnv();
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): JwtPayload {
  const { JWT_SECRET } = getEnv();
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * Generate a cryptographically secure refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a refresh token for secure storage
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: JwtPayload): {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  expiresIn: number;
} {
  const accessToken = signAccessToken(payload);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  return {
    accessToken,
    refreshToken,
    refreshTokenHash,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  };
}

/**
 * Calculate refresh token expiry date
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiry;
}
