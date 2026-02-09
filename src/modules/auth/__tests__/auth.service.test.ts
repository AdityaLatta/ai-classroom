import { AuthService } from "../auth.service";
import { UserRepository } from "../../users/user.repository";
import { RefreshTokenRepository } from "../refreshToken.repository";
import { EmailVerificationRepository } from "../emailVerification.repository";
import { PasswordResetRepository } from "../passwordReset.repository";
import { AppError } from "../../../utils/AppError";
import bcrypt from "bcryptjs";

// Mock dependencies
jest.mock("../../users/user.repository");
jest.mock("../refreshToken.repository");
jest.mock("../emailVerification.repository");
jest.mock("../passwordReset.repository");
jest.mock("../../../infra/mailer", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  verificationEmailHtml: jest.fn().mockReturnValue("<html>verify</html>"),
  passwordResetEmailHtml: jest.fn().mockReturnValue("<html>reset</html>"),
}));
jest.mock("bcryptjs");
jest.mock("../../../auth/google", () => ({
  verifyGoogleToken: jest.fn(),
}));

const mockClient = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
jest.mock("../../../infra/db", () => ({
  getDb: jest.fn(),
  withTransaction: jest.fn(async (callback: (client: typeof mockClient) => Promise<unknown>) => {
    return callback(mockClient);
  }),
}));

import { verifyGoogleToken } from "../../../auth/google";

describe("AuthService - Email/Password Auth", () => {
  let service: AuthService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockRefreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
  let mockEmailVerifRepo: jest.Mocked<EmailVerificationRepository>;
  let mockPasswordResetRepo: jest.Mocked<PasswordResetRepository>;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "STUDENT" as const,
    passwordHash: "$2a$12$hashedpassword",
    emailVerified: true,
    authProvider: "email" as const,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
    mockUserRepo = new UserRepository() as jest.Mocked<UserRepository>;
    mockRefreshTokenRepo =
      new RefreshTokenRepository() as jest.Mocked<RefreshTokenRepository>;
    mockEmailVerifRepo =
      new EmailVerificationRepository() as jest.Mocked<EmailVerificationRepository>;
    mockPasswordResetRepo =
      new PasswordResetRepository() as jest.Mocked<PasswordResetRepository>;
    service = new AuthService(
      mockUserRepo,
      mockRefreshTokenRepo,
      mockEmailVerifRepo,
      mockPasswordResetRepo,
    );
  });

  describe("register", () => {
    it("should register a new user and send verification email", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.createWithPassword.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });
      mockEmailVerifRepo.create.mockResolvedValue("raw-verification-token");
      (bcrypt.hash as jest.Mock).mockResolvedValue("$2a$12$hashedpassword");

      const result = await service.register({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      expect(result.message).toContain("Registration successful");
      expect(mockUserRepo.createWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        passwordHash: "$2a$12$hashedpassword",
      });
      expect(mockEmailVerifRepo.create).toHaveBeenCalled();
    });

    it("should throw 409 if email already exists", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: "test@example.com",
          password: "Password123",
          name: "Test User",
        }),
      ).rejects.toThrow(AppError);

      try {
        await service.register({
          email: "test@example.com",
          password: "Password123",
          name: "Test User",
        });
      } catch (error) {
        expect((error as AppError).statusCode).toBe(409);
      }
    });
  });

  describe("login", () => {
    it("should return auth tokens for valid credentials", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRefreshTokenRepo.create.mockResolvedValue({
        id: "rt-1",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date(),
        revoked: false,
        deviceInfo: null,
        ipAddress: null,
        createdAt: new Date(),
        lastUsedAt: null,
      });

      const result = await service.login({
        email: "test@example.com",
        password: "Password123",
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe("test@example.com");
    });

    it("should throw 401 if user not found", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: "no@user.com", password: "Password123" }),
      ).rejects.toThrow(AppError);

      try {
        await service.login({ email: "no@user.com", password: "Password123" });
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe("Invalid email or password");
      }
    });

    it("should throw 401 if user has no password (Google-only user)", async () => {
      mockUserRepo.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
        authProvider: "google" as const,
      });

      await expect(
        service.login({
          email: "test@example.com",
          password: "Password123",
        }),
      ).rejects.toThrow(AppError);

      try {
        await service.login({
          email: "test@example.com",
          password: "Password123",
        });
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe("Invalid email or password");
      }
    });

    it("should throw 401 if password is incorrect", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: "test@example.com",
          password: "WrongPassword1",
        }),
      ).rejects.toThrow(AppError);

      try {
        await service.login({
          email: "test@example.com",
          password: "WrongPassword1",
        });
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
      }
    });

    it("should throw 403 if email is not verified", async () => {
      mockUserRepo.findByEmail.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({
          email: "test@example.com",
          password: "Password123",
        }),
      ).rejects.toThrow(AppError);

      try {
        await service.login({
          email: "test@example.com",
          password: "Password123",
        });
      } catch (error) {
        expect((error as AppError).statusCode).toBe(403);
      }
    });
  });

  describe("verifyEmail", () => {
    it("should verify email with valid token", async () => {
      mockEmailVerifRepo.findValidByRawToken.mockResolvedValue({
        id: "token-1",
        userId: "user-123",
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        createdAt: new Date(),
      });

      const result = await service.verifyEmail("valid-raw-token");

      expect(result.message).toContain("Email verified successfully");
      expect(mockEmailVerifRepo.markUsed).toHaveBeenCalledWith("token-1");
      expect(mockUserRepo.markEmailVerified).toHaveBeenCalledWith("user-123");
    });

    it("should throw 400 for invalid or expired token", async () => {
      mockEmailVerifRepo.findValidByRawToken.mockResolvedValue(null);

      await expect(service.verifyEmail("bad-token")).rejects.toThrow(AppError);

      try {
        await service.verifyEmail("bad-token");
      } catch (error) {
        expect((error as AppError).statusCode).toBe(400);
      }
    });
  });

  describe("resendVerificationEmail", () => {
    it("should send verification email for unverified user", async () => {
      mockUserRepo.findByEmail.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });
      mockEmailVerifRepo.create.mockResolvedValue("new-raw-token");

      const result = await service.resendVerificationEmail("test@example.com");

      expect(result.message).toContain("verification email has been sent");
      expect(mockEmailVerifRepo.create).toHaveBeenCalled();
    });

    it("should return generic response for non-existent email", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      const result =
        await service.resendVerificationEmail("nonexistent@example.com");

      expect(result.message).toContain("verification email has been sent");
      expect(mockEmailVerifRepo.create).not.toHaveBeenCalled();
    });

    it("should return generic response for already verified user", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser); // emailVerified: true

      const result = await service.resendVerificationEmail("test@example.com");

      expect(result.message).toContain("verification email has been sent");
      expect(mockEmailVerifRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("should send reset email for existing user", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      mockPasswordResetRepo.create.mockResolvedValue("raw-reset-token");

      const result = await service.forgotPassword("test@example.com");

      expect(result.message).toContain("password reset email has been sent");
      expect(mockPasswordResetRepo.create).toHaveBeenCalledWith("user-123");
    });

    it("should return generic response for non-existent email", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword("nonexistent@example.com");

      expect(result.message).toContain("password reset email has been sent");
      expect(mockPasswordResetRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid token", async () => {
      mockPasswordResetRepo.findValidByRawToken.mockResolvedValue({
        id: "reset-1",
        userId: "user-123",
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        createdAt: new Date(),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue("$2a$12$newhashedpassword");
      mockClient.query.mockClear();

      const result = await service.resetPassword(
        "valid-reset-token",
        "NewPassword123",
      );

      expect(result.message).toContain("Password has been reset");
      // Verify transaction queries were called
      expect(mockClient.query).toHaveBeenCalledTimes(4);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET password_hash"),
        ["$2a$12$newhashedpassword", "user-123"],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE password_reset_tokens SET used_at"),
        ["reset-1"],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE refresh_tokens SET revoked"),
        ["user-123"],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET email_verified"),
        ["user-123"],
      );
    });

    it("should throw 400 for invalid or expired token", async () => {
      mockPasswordResetRepo.findValidByRawToken.mockResolvedValue(null);

      await expect(
        service.resetPassword("bad-token", "NewPassword123"),
      ).rejects.toThrow(AppError);

      try {
        await service.resetPassword("bad-token", "NewPassword123");
      } catch (error) {
        expect((error as AppError).statusCode).toBe(400);
      }
    });
  });

  describe("setPassword", () => {
    it("should set password for OAuth user without existing password", async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
        authProvider: "google" as const,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue("$2a$12$newhashedpassword");

      const result = await service.setPassword("user-123", "NewPassword123");

      expect(result.message).toContain("Password set successfully");
      expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith(
        "user-123",
        "$2a$12$newhashedpassword",
      );
    });

    it("should throw 404 if user not found", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.setPassword("nonexistent", "NewPassword123"),
      ).rejects.toThrow(AppError);

      try {
        await service.setPassword("nonexistent", "NewPassword123");
      } catch (error) {
        expect((error as AppError).statusCode).toBe(404);
      }
    });

    it("should throw 409 if password is already set", async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser); // has passwordHash

      await expect(
        service.setPassword("user-123", "NewPassword123"),
      ).rejects.toThrow(AppError);

      try {
        await service.setPassword("user-123", "NewPassword123");
      } catch (error) {
        expect((error as AppError).statusCode).toBe(409);
      }
    });
  });

  // --- Tests for existing auth methods ---

  describe("loginWithGoogle", () => {
    it("should login with valid Google token", async () => {
      (verifyGoogleToken as jest.Mock).mockResolvedValue({
        email: "google@example.com",
        name: "Google User",
      });
      mockUserRepo.findOrCreate.mockResolvedValue({
        ...mockUser,
        email: "google@example.com",
        authProvider: "google" as const,
      });
      mockRefreshTokenRepo.create.mockResolvedValue({
        id: "rt-1",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date(),
        revoked: false,
        deviceInfo: null,
        ipAddress: null,
        createdAt: new Date(),
        lastUsedAt: null,
      });

      const result = await service.loginWithGoogle({
        idToken: "valid-google-token",
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe("google@example.com");
      expect(mockUserRepo.findOrCreate).toHaveBeenCalledWith({
        email: "google@example.com",
        name: "Google User",
      });
    });

    it("should propagate Google token verification errors", async () => {
      (verifyGoogleToken as jest.Mock).mockRejectedValue(
        new AppError(401, "Invalid Google token"),
      );

      await expect(
        service.loginWithGoogle({ idToken: "bad-token" }),
      ).rejects.toThrow("Invalid Google token");
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh tokens with valid refresh token", async () => {
      mockRefreshTokenRepo.findValidByHash.mockResolvedValue({
        id: "rt-1",
        userId: "user-123",
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revoked: false,
        deviceInfo: null,
        ipAddress: null,
        createdAt: new Date(),
        lastUsedAt: null,
      });
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockRefreshTokenRepo.create.mockResolvedValue({
        id: "rt-2",
        userId: "user-123",
        tokenHash: "newhash",
        expiresAt: new Date(),
        revoked: false,
        deviceInfo: null,
        ipAddress: null,
        createdAt: new Date(),
        lastUsedAt: null,
      });

      const result = await service.refreshAccessToken({
        refreshToken: "valid-refresh-token",
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith("rt-1");
    });

    it("should throw 401 for invalid refresh token", async () => {
      mockRefreshTokenRepo.findValidByHash.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken({ refreshToken: "invalid" }),
      ).rejects.toThrow(AppError);

      try {
        await service.refreshAccessToken({ refreshToken: "invalid" });
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
      }
    });

    it("should throw 401 if user not found for refresh token", async () => {
      mockRefreshTokenRepo.findValidByHash.mockResolvedValue({
        id: "rt-1",
        userId: "deleted-user",
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revoked: false,
        deviceInfo: null,
        ipAddress: null,
        createdAt: new Date(),
        lastUsedAt: null,
      });
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken({ refreshToken: "valid-token" }),
      ).rejects.toThrow(AppError);

      try {
        await service.refreshAccessToken({ refreshToken: "valid-token" });
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
      }
    });
  });

  describe("logout", () => {
    it("should revoke refresh token", async () => {
      await service.logout("some-refresh-token");

      expect(mockRefreshTokenRepo.revokeByHash).toHaveBeenCalled();
    });
  });

  describe("logoutAll", () => {
    it("should revoke all refresh tokens for user", async () => {
      await service.logoutAll("user-123");

      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith(
        "user-123",
      );
    });
  });

  describe("getCurrentUser", () => {
    it("should return user for valid access token", async () => {
      // We need a real token for this test
      const { signAccessToken } = jest.requireActual("../.././../auth/jwt");
      const token = signAccessToken({
        sub: "user-123",
        role: "STUDENT",
        email: "test@example.com",
      });
      mockUserRepo.findById.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser(token);

      expect(result.id).toBe("user-123");
      expect(result.email).toBe("test@example.com");
    });

    it("should throw 401 for invalid access token", async () => {
      await expect(
        service.getCurrentUser("invalid-token"),
      ).rejects.toThrow(AppError);

      try {
        await service.getCurrentUser("invalid-token");
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
      }
    });

    it("should throw 401 if user not found", async () => {
      const { signAccessToken } = jest.requireActual("../.././../auth/jwt");
      const token = signAccessToken({
        sub: "deleted-user",
        role: "STUDENT",
        email: "test@example.com",
      });
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser(token)).rejects.toThrow(AppError);

      try {
        await service.getCurrentUser(token);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
      }
    });
  });

  describe("getUserById", () => {
    it("should return user when found", async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);

      const result = await service.getUserById("user-123");

      expect(result).toEqual(mockUser);
    });

    it("should return null when user not found", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await service.getUserById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getActiveSessions", () => {
    it("should return active sessions for user", async () => {
      const mockSessions = [
        {
          id: "rt-1",
          userId: "user-123",
          tokenHash: "hash1",
          expiresAt: new Date(),
          revoked: false,
          deviceInfo: "Chrome",
          ipAddress: "127.0.0.1",
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
      ];
      mockRefreshTokenRepo.getActiveSessionsForUser.mockResolvedValue(
        mockSessions,
      );

      const result = await service.getActiveSessions("user-123");

      expect(result).toEqual(mockSessions);
      expect(
        mockRefreshTokenRepo.getActiveSessionsForUser,
      ).toHaveBeenCalledWith("user-123");
    });
  });

  describe("revokeSession", () => {
    it("should revoke a specific session", async () => {
      mockRefreshTokenRepo.getActiveSessionsForUser.mockResolvedValue([
        {
          id: "session-1",
          userId: "user-123",
          tokenHash: "hash",
          expiresAt: new Date(),
          revoked: false,
          deviceInfo: null,
          ipAddress: null,
          createdAt: new Date(),
          lastUsedAt: null,
        },
      ]);

      await service.revokeSession("user-123", "session-1");

      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith("session-1");
    });

    it("should throw 404 if session not found", async () => {
      mockRefreshTokenRepo.getActiveSessionsForUser.mockResolvedValue([]);

      await expect(
        service.revokeSession("user-123", "nonexistent"),
      ).rejects.toThrow(AppError);

      try {
        await service.revokeSession("user-123", "nonexistent");
      } catch (error) {
        expect((error as AppError).statusCode).toBe(404);
      }
    });
  });
});
