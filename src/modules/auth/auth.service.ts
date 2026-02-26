import bcrypt from "bcryptjs";
import { PoolClient } from "pg";
import { verifyGoogleToken } from "@/auth/google";
import {
  generateTokenPair,
  hashRefreshToken,
  verifyAccessToken,
  JwtPayload,
} from "@/auth/jwt";
import { getEnv } from "@/config";
import { logger, AppError, ErrorCode, Cache } from "@/utils";
import {
  sendEmail,
  verificationEmailHtml,
  passwordResetEmailHtml,
  withTransaction,
  tryGetContext,
} from "@/infra";
import { eventBus } from "@/infra/eventBus";
import { IUserRepository, User } from "@/modules/users/user.types";
import {
  AuthTokens,
  LoginWithGoogleDTO,
  RefreshTokenDTO,
  RegisterDTO,
  LoginDTO,
  ChangePasswordDTO,
  IRefreshTokenRepository,
  IEmailVerificationRepository,
  IPasswordResetRepository,
} from "./auth.types";
import { LoginAttemptTracker } from "./loginAttemptTracker";

const BCRYPT_ROUNDS = 12;

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly emailVerificationRepo: IEmailVerificationRepository,
    private readonly passwordResetRepo: IPasswordResetRepository,
    private readonly loginAttemptTracker: LoginAttemptTracker,
  ) {}

  async loginWithGoogle(dto: LoginWithGoogleDTO): Promise<AuthTokens> {
    const googleUser = await verifyGoogleToken(dto.idToken);

    const { user, isNew } = await this.userRepo.findOrCreate({
      email: googleUser.email,
      name: googleUser.name,
    });

    eventBus.emit("auth:google-login", {
      userId: user.id,
      email: user.email,
      ip: dto.ipAddress,
      userAgent: dto.deviceInfo,
    });

    return this.createAuthTokens(user, dto.deviceInfo, dto.ipAddress, isNew);
  }

  async refreshAccessToken(dto: RefreshTokenDTO): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(dto.refreshToken);

    const storedToken = await this.refreshTokenRepo.findValidByHash(tokenHash);
    if (!storedToken) {
      throw new AppError(401, "Invalid or expired refresh token", ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    }

    const user = await this.userRepo.findById(storedToken.userId);
    if (!user) {
      throw new AppError(401, "User not found", ErrorCode.AUTH_USER_NOT_FOUND);
    }

    // Revoke old refresh token (rotation for security)
    await this.refreshTokenRepo.revoke(storedToken.id);

    eventBus.emit("auth:token-refreshed", {
      userId: user.id,
      ip: dto.ipAddress,
    });

    return this.createAuthTokens(user, dto.deviceInfo, dto.ipAddress);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.refreshTokenRepo.revokeByHash(tokenHash);

    const ctx = tryGetContext();
    eventBus.emit("auth:logout", { userId: ctx?.userId });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepo.revokeAllForUser(userId);

    eventBus.emit("auth:logout-all", { userId });
  }

  async getCurrentUser(accessToken: string): Promise<User> {
    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(accessToken);
    } catch {
      throw new AppError(401, "Invalid or expired access token", ErrorCode.AUTH_ACCESS_TOKEN_INVALID);
    }

    const user = await this.userRepo.findById(payload.sub);
    if (!user) {
      throw new AppError(401, "User not found", ErrorCode.AUTH_USER_NOT_FOUND);
    }

    return user;
  }

  @Cache({ ttl: 60_000, key: (userId: unknown) => `${userId}` })
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepo.findById(userId);
  }

  async getActiveSessions(userId: string) {
    return this.refreshTokenRepo.getActiveSessionsForUser(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const sessions =
      await this.refreshTokenRepo.getActiveSessionsForUser(userId);
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      throw new AppError(404, "Session not found", ErrorCode.AUTH_SESSION_NOT_FOUND);
    }

    await this.refreshTokenRepo.revoke(sessionId);

    eventBus.emit("auth:session-revoked", { userId, sessionId });
  }

  /**
   * Register with email and password.
   * Returns a generic message to prevent user enumeration.
   */
  async register(
    dto: RegisterDTO,
  ): Promise<{ message: string }> {
    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) {
      // Don't reveal whether the email exists. Return same message as success.
      // Optionally send a "someone tried to register with your email" notification.
      logger.warn({ email: dto.email }, "Registration attempt for existing email");
      return {
        message:
          "If this email is not already registered, a verification email has been sent.",
      };
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userRepo.createWithPassword({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    await this.sendVerificationEmail(user.id, user.email, user.name);

    eventBus.emit("auth:registered", {
      userId: user.id,
      email: user.email,
    });

    return {
      message:
        "If this email is not already registered, a verification email has been sent.",
    };
  }

  /**
   * Login with email and password (with account lockout).
   */
  async login(dto: LoginDTO): Promise<AuthTokens> {
    this.loginAttemptTracker.check(dto.email);

    const user = await this.userRepo.findByEmail(dto.email);

    if (!user || !user.passwordHash) {
      this.loginAttemptTracker.recordFailure(dto.email, dto.ipAddress);
      throw new AppError(401, "Invalid email or password", ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.loginAttemptTracker.recordFailure(dto.email, dto.ipAddress);
      throw new AppError(401, "Invalid email or password", ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (!user.emailVerified) {
      throw new AppError(
        403,
        "Please verify your email address before logging in",
        ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
      );
    }

    // Clear lockout on successful login
    this.loginAttemptTracker.clear(dto.email);

    eventBus.emit("auth:login", {
      userId: user.id,
      email: user.email,
      ip: dto.ipAddress,
      userAgent: dto.deviceInfo,
    });

    return this.createAuthTokens(user, dto.deviceInfo, dto.ipAddress);
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenRecord =
      await this.emailVerificationRepo.findValidByRawToken(rawToken);
    if (!tokenRecord) {
      throw new AppError(400, "Invalid or expired verification token", ErrorCode.AUTH_VERIFICATION_TOKEN_INVALID);
    }

    await this.emailVerificationRepo.markUsed(tokenRecord.id);
    await this.userRepo.markEmailVerified(tokenRecord.userId);

    eventBus.emit("auth:email-verified", { userId: tokenRecord.userId });

    return { message: "Email verified successfully. You can now log in." };
  }

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

  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message:
        "If an account with that email exists, a password reset email has been sent.",
    };

    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
      return genericResponse;
    }

    const rawToken = await this.passwordResetRepo.create(user.id);
    const { FRONTEND_URL, NODE_ENV } = getEnv();
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

    if (NODE_ENV === "development") {
      logger.info({ token: rawToken }, "DEV: Password reset token");
    }

    await sendEmail(
      user.email,
      "Reset Your Password",
      passwordResetEmailHtml(user.name, resetUrl),
    );

    eventBus.emit("auth:password-reset-requested", {
      userId: user.id,
      email: user.email,
    });

    return genericResponse;
  }

  /**
   * Reset password with token.
   * Uses repository methods inside a transaction (no raw SQL in service layer).
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenRecord =
      await this.passwordResetRepo.findValidByRawToken(rawToken);
    if (!tokenRecord) {
      throw new AppError(400, "Invalid or expired password reset token", ErrorCode.AUTH_RESET_TOKEN_INVALID);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await withTransaction(async (client: PoolClient) => {
      await this.userRepo.updatePasswordHash(tokenRecord.userId, passwordHash, client);
      await this.passwordResetRepo.markUsed(tokenRecord.id, client);
      await this.refreshTokenRepo.revokeAllForUser(tokenRecord.userId, client);
      await this.userRepo.markEmailVerified(tokenRecord.userId, client);
    });

    eventBus.emit("auth:password-reset-completed", {
      userId: tokenRecord.userId,
    });

    return {
      message:
        "Password has been reset successfully. Please log in with your new password.",
    };
  }

  /**
   * Set password for OAuth users (account linking).
   */
  async setPassword(
    userId: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found", ErrorCode.AUTH_USER_NOT_FOUND);
    }

    if (user.passwordHash) {
      throw new AppError(
        409,
        "Password is already set. Use forgot-password to change it.",
        ErrorCode.AUTH_PASSWORD_ALREADY_SET,
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.userRepo.updatePasswordHash(userId, passwordHash);

    eventBus.emit("auth:password-set", { userId });

    return {
      message:
        "Password set successfully. You can now log in with email and password.",
    };
  }

  /**
   * Change password (requires knowing old password).
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDTO,
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found", ErrorCode.AUTH_USER_NOT_FOUND);
    }

    if (!user.passwordHash) {
      throw new AppError(
        400,
        "No password set. Use set-password to create one.",
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, "Current password is incorrect", ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await withTransaction(async (client: PoolClient) => {
      await this.userRepo.updatePasswordHash(userId, newHash, client);
      // Revoke all sessions so user must re-login with new password
      await this.refreshTokenRepo.revokeAllForUser(userId, client);
    });

    eventBus.emit("auth:password-changed", { userId });

    return {
      message: "Password changed successfully. Please log in again.",
    };
  }

  async selectRole(userId: string, role: "STUDENT" | "INSTRUCTOR"): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found", ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const updated = await this.userRepo.update(userId, { role });
    if (!updated) {
      throw new AppError(404, "User not found", ErrorCode.AUTH_USER_NOT_FOUND);
    }
    return updated;
  }

  // --- Private helpers ---

  private async createAuthTokens(
    user: User,
    deviceInfo?: string,
    ipAddress?: string,
    isNewUser?: boolean,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const { accessToken, refreshToken, refreshTokenHash, expiresIn } =
      generateTokenPair(payload);

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
      ...(isNewUser !== undefined ? { isNewUser } : {}),
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
      logger.info({ token: rawToken }, "DEV: Email verification token");
    }

    await sendEmail(
      email,
      "Verify Your Email Address",
      verificationEmailHtml(name, verifyUrl),
    );
  }

}
