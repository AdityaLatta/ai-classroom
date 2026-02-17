import { AuthService } from "@/modules/auth/auth.service";
import { LoginAttemptTracker } from "@/modules/auth/loginAttemptTracker";
import { UserRepository } from "@/modules/users/user.repository";
import { RefreshTokenRepository } from "@/modules/auth/refreshToken.repository";
import { EmailVerificationRepository } from "@/modules/auth/emailVerification.repository";
import { PasswordResetRepository } from "@/modules/auth/passwordReset.repository";
import { AppError } from "@/utils/AppError";
import bcrypt from "bcryptjs";

// Mock dependencies
jest.mock("@/modules/users/user.repository");
jest.mock("@/modules/auth/refreshToken.repository");
jest.mock("@/modules/auth/emailVerification.repository");
jest.mock("@/modules/auth/passwordReset.repository");
jest.mock("@/infra/mailer", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  verificationEmailHtml: jest.fn().mockReturnValue("<html>verify</html>"),
  passwordResetEmailHtml: jest.fn().mockReturnValue("<html>reset</html>"),
}));
jest.mock("bcryptjs");
jest.mock("@/auth/google", () => ({
  verifyGoogleToken: jest.fn(),
}));

const mockClient = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
jest.mock("@/infra/db", () => ({
  getDb: jest.fn(),
  withTransaction: jest.fn(async (callback: (client: typeof mockClient) => Promise<unknown>) => {
    return callback(mockClient);
  }),
}));

import { verifyGoogleToken } from "@/auth/google";

describe("AuthService", () => {
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
      new LoginAttemptTracker(),
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

      expect(result.message).toContain("verification email");
      expect(mockUserRepo.createWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        passwordHash: "$2a$12$hashedpassword",
      });
      expect(mockEmailVerifRepo.create).toHaveBeenCalled();
    });

    it("should return generic message when email exists (no enumeration)", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await service.register({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      // Should NOT throw - returns generic message instead
      expect(result.message).toContain("verification email");
      expect(mockUserRepo.createWithPassword).not.toHaveBeenCalled();
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
    it("should reset password using repository methods in transaction", async () => {
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
      // Verify repository methods are called within the transaction
      expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith(
        "user-123",
        "$2a$12$newhashedpassword",
        mockClient,
      );
      expect(mockPasswordResetRepo.markUsed).toHaveBeenCalledWith("reset-1", mockClient);
      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith("user-123", mockClient);
      expect(mockUserRepo.markEmailVerified).toHaveBeenCalledWith("user-123", mockClient);
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

  describe("changePassword", () => {
    it("should change password when current password is correct", async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue("$2a$12$newhashedpassword");

      const result = await service.changePassword("user-123", {
        currentPassword: "Password123",
        newPassword: "NewPassword456",
      });

      expect(result.message).toContain("changed successfully");
    });

    it("should throw 401 when current password is wrong", async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword("user-123", {
          currentPassword: "WrongPass1",
          newPassword: "NewPassword456",
        }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("should throw 400 when no password is set (OAuth user)", async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      await expect(
        service.changePassword("user-123", {
          currentPassword: "anything",
          newPassword: "NewPassword456",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

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
      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith("rt-1");
    });

    it("should throw 401 for invalid refresh token", async () => {
      mockRefreshTokenRepo.findValidByHash.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken({ refreshToken: "invalid" }),
      ).rejects.toMatchObject({ statusCode: 401 });
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
      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith("user-123");
    });
  });

  describe("getCurrentUser", () => {
    it("should return user for valid access token", async () => {
      const { signAccessToken } = jest.requireActual("@/auth/jwt");
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
      ).rejects.toMatchObject({ statusCode: 401 });
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
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
