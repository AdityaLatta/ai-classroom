import bcrypt from "bcryptjs";
import { verifyGoogleToken } from "../../auth/google";
import {
  generateTokenPair,
  hashRefreshToken,
  verifyAccessToken,
  JwtPayload,
} from "../../auth/jwt";
import { getEnv } from "../../config/env";
import { logger } from "../../utils/logger";
import {
  sendEmail,
  verificationEmailHtml,
  passwordResetEmailHtml,
} from "../../infra/mailer";
import { withTransaction } from "../../infra/db";
import { AppError } from "../../utils/AppError";
import { IUserRepository, User } from "../users/user.repository";
import { IRefreshTokenRepository } from "./refreshToken.repository";
import { IEmailVerificationRepository } from "./emailVerification.repository";
import { IPasswordResetRepository } from "./passwordReset.repository";

const BCRYPT_ROUNDS = 12;

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

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly emailVerificationRepo: IEmailVerificationRepository,
    private readonly passwordResetRepo: IPasswordResetRepository,
  ) {}

  /**
   * Login with Google OAuth
   */
  async loginWithGoogle(dto: LoginWithGoogleDTO): Promise<AuthTokens> {
    // Verify Google token
    const googleUser = await verifyGoogleToken(dto.idToken);

    // Find or create user
    const user = await this.userRepo.findOrCreate({
      email: googleUser.email,
      name: googleUser.name,
    });

    // Generate tokens
    return this.createAuthTokens(user, dto.deviceInfo, dto.ipAddress);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(dto: RefreshTokenDTO): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(dto.refreshToken);

    // Find valid refresh token
    const storedToken = await this.refreshTokenRepo.findValidByHash(tokenHash);
    if (!storedToken) {
      throw new AppError(401, "Invalid or expired refresh token", "AUTH_REFRESH_TOKEN_INVALID");
    }

    // Get user
    const user = await this.userRepo.findById(storedToken.userId);
    if (!user) {
      throw new AppError(401, "User not found", "AUTH_USER_NOT_FOUND");
    }

    // Revoke old refresh token (rotation for security)
    await this.refreshTokenRepo.revoke(storedToken.id);

    // Generate new tokens
    return this.createAuthTokens(user, dto.deviceInfo, dto.ipAddress);
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.refreshTokenRepo.revokeByHash(tokenHash);
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepo.revokeAllForUser(userId);
  }

  /**
   * Get current user from access token
   */
  async getCurrentUser(accessToken: string): Promise<User> {
    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(accessToken);
    } catch {
      throw new AppError(401, "Invalid or expired access token", "AUTH_ACCESS_TOKEN_INVALID");
    }

    const user = await this.userRepo.findById(payload.sub);
    if (!user) {
      throw new AppError(401, "User not found", "AUTH_USER_NOT_FOUND");
    }

    return user;
  }

  /**
   * Get user by ID (for internal use)
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepo.findById(userId);
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string) {
    return this.refreshTokenRepo.getActiveSessionsForUser(userId);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const sessions =
      await this.refreshTokenRepo.getActiveSessionsForUser(userId);
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      throw new AppError(404, "Session not found", "AUTH_SESSION_NOT_FOUND");
    }

    await this.refreshTokenRepo.revoke(sessionId);
  }

  /**
   * Register with email and password
   */
  async register(
    dto: RegisterDTO,
  ): Promise<{ message: string }> {
    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) {
      throw new AppError(409, "An account with this email already exists", "AUTH_EMAIL_EXISTS");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userRepo.createWithPassword({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    await this.sendVerificationEmail(user.id, user.email, user.name);

    return {
      message:
        "Registration successful. Please check your email to verify your account.",
    };
  }

  /**
   * Login with email and password
   */
  async login(dto: LoginDTO): Promise<AuthTokens> {
    const user = await this.userRepo.findByEmail(dto.email);

    if (!user || !user.passwordHash) {
      throw new AppError(401, "Invalid email or password", "AUTH_INVALID_CREDENTIALS");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new AppError(401, "Invalid email or password", "AUTH_INVALID_CREDENTIALS");
    }

    if (!user.emailVerified) {
      throw new AppError(
        403,
        "Please verify your email address before logging in",
        "AUTH_EMAIL_NOT_VERIFIED",
      );
    }

    return this.createAuthTokens(user, dto.deviceInfo, dto.ipAddress);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenRecord =
      await this.emailVerificationRepo.findValidByRawToken(rawToken);
    if (!tokenRecord) {
      throw new AppError(400, "Invalid or expired verification token", "AUTH_VERIFICATION_TOKEN_INVALID");
    }

    await this.emailVerificationRepo.markUsed(tokenRecord.id);
    await this.userRepo.markEmailVerified(tokenRecord.userId);

    return { message: "Email verified successfully. You can now log in." };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(
    email: string,
  ): Promise<{ message: string }> {
    const genericResponse = {
      message:
        "If an account with that email exists and is unverified, a verification email has been sent.",
    };

    const user = await this.userRepo.findByEmail(email);
    if (!user || user.emailVerified) {
      return genericResponse;
    }

    await this.sendVerificationEmail(user.id, user.email, user.name);
    return genericResponse;
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message:
        "If an account with that email exists, a password reset email has been sent.",
    };

    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
      // Don't send reset emails to Google-only users (no password to reset)
      return genericResponse;
    }

    const rawToken = await this.passwordResetRepo.create(user.id);
    const { FRONTEND_URL, NODE_ENV } = getEnv();
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

    if (NODE_ENV === "development") {
      logger.info({ token: rawToken }, "🔑 [DEV] Password reset token");
    }

    await sendEmail(
      user.email,
      "Reset Your Password",
      passwordResetEmailHtml(user.name, resetUrl),
    );

    return genericResponse;
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenRecord =
      await this.passwordResetRepo.findValidByRawToken(rawToken);
    if (!tokenRecord) {
      throw new AppError(400, "Invalid or expired password reset token", "AUTH_RESET_TOKEN_INVALID");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await withTransaction(async (client) => {
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
        passwordHash,
        tokenRecord.userId,
      ]);
      await client.query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
        [tokenRecord.id],
      );
      await client.query(
        `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
        [tokenRecord.userId],
      );
      await client.query(
        `UPDATE users SET email_verified = true WHERE id = $1`,
        [tokenRecord.userId],
      );
    });

    return {
      message:
        "Password has been reset successfully. Please log in with your new password.",
    };
  }

  /**
   * Set password for OAuth users (account linking)
   */
  async setPassword(
    userId: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found", "AUTH_USER_NOT_FOUND");
    }

    if (user.passwordHash) {
      throw new AppError(
        409,
        "Password is already set. Use forgot-password to change it.",
        "AUTH_PASSWORD_ALREADY_SET",
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.userRepo.updatePasswordHash(userId, passwordHash);

    return {
      message:
        "Password set successfully. You can now log in with email and password.",
    };
  }

  /**
   * Helper to create auth tokens and store refresh token
   */
  private async createAuthTokens(
    user: User,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const { accessToken, refreshToken, refreshTokenHash, expiresIn } =
      generateTokenPair(payload);

    // Store refresh token
    await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: refreshTokenHash,
      deviceInfo,
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  private async sendVerificationEmail(
    userId: string,
    email: string,
    name: string,
  ): Promise<void> {
    const rawToken = await this.emailVerificationRepo.create(userId);
    const { FRONTEND_URL, NODE_ENV } = getEnv();
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${rawToken}`;

    if (NODE_ENV === "development") {
      logger.info({ token: rawToken }, "📧 [DEV] Email verification token");
    }

    await sendEmail(
      email,
      "Verify Your Email Address",
      verificationEmailHtml(name, verifyUrl),
    );
  }
}
