import request from "supertest";
import { createApp } from "../../../app";
import { signAccessToken, JwtPayload } from "../../../auth/jwt";
import { Express } from "express";

// Create mock query function
const mockQuery = jest.fn();

// Mock the database
jest.mock("../../../infra/db", () => ({
  getDb: jest.fn(() => ({
    query: mockQuery,
  })),
  initDb: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
  withTransaction: jest.fn(async (callback: (client: { query: typeof mockQuery }) => Promise<unknown>) => {
    return callback({ query: mockQuery });
  }),
}));

// Mock the mailer
jest.mock("../../../infra/mailer", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  verificationEmailHtml: jest.fn().mockReturnValue("<html>verify</html>"),
  passwordResetEmailHtml: jest.fn().mockReturnValue("<html>reset</html>"),
}));

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2a$12$mockedhashvalue"),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock rate limiters to prevent 429 in tests
jest.mock("../../../middlewares/rateLimiter", () => {
  const passthrough = (
    _req: unknown,
    _res: unknown,
    next: () => void,
  ) => next();
  return {
    apiLimiter: passthrough,
    authLimiter: passthrough,
    strictLimiter: passthrough,
  };
});

import bcrypt from "bcryptjs";
import { sendEmail } from "../../../infra/mailer";

describe("Auth API - Email/Password", () => {
  let app: Express;
  let authToken: string;

  const userPayload: JwtPayload = {
    sub: "user-123",
    role: "STUDENT",
    email: "test@example.com",
  };

  const mockUserRow = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "STUDENT",
    password_hash: "$2a$12$mockedhashvalue",
    email_verified: true,
    auth_provider: "email",
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
  };

  beforeAll(() => {
    app = createApp();
    authToken = signAccessToken(userPayload);
  });

  beforeEach(() => {
    mockQuery.mockReset();
    (bcrypt.hash as jest.Mock).mockResolvedValue("$2a$12$mockedhashvalue");
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (sendEmail as jest.Mock).mockClear();
  });

  // --- POST /api/auth/register ---

  describe("POST /api/auth/register", () => {
    const validBody = {
      email: "new@example.com",
      password: "Password123",
      name: "New User",
    };

    it("should register a new user", async () => {
      // findByEmail returns null (user doesn't exist)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // createWithPassword returns new user
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, email: "new@example.com", name: "New User" }],
        rowCount: 1,
      });
      // emailVerificationRepo: invalidate old tokens
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // emailVerificationRepo: insert new token
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .post("/api/auth/register")
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body.message).toContain("Registration successful");
      expect(sendEmail).toHaveBeenCalled();
    });

    it("should return 409 if email already exists", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send(validBody);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain("already exists");
    });

    it("should return 400 for invalid email", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: "not-an-email", password: "Password123", name: "Test" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 for weak password", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "short", name: "Test" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 for missing name", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "Password123" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 400 for password without uppercase", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          password: "password123",
          name: "Test",
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: "password" }),
      );
    });
  });

  // --- POST /api/auth/login ---

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      // findByEmail
      mockQuery.mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
      });
      // refreshTokenRepo.create
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "rt-1",
            user_id: "user-123",
            token_hash: "hash",
            expires_at: new Date(),
            revoked: false,
            device_info: null,
            ip_address: null,
            created_at: new Date(),
            last_used_at: null,
          },
        ],
        rowCount: 1,
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "Password123" });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe("test@example.com");
    });

    it("should return 401 for non-existent user", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "no@user.com", password: "Password123" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should return 401 for wrong password", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "WrongPassword1" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should return 403 for unverified email", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, email_verified: false }],
        rowCount: 1,
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "Password123" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("verify your email");
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  // --- POST /api/auth/verify-email ---

  describe("POST /api/auth/verify-email", () => {
    it("should verify email with valid token", async () => {
      // findValidByRawToken
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "vt-1",
            user_id: "user-123",
            token_hash: "hash",
            expires_at: new Date(Date.now() + 86400000),
            used_at: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });
      // markUsed
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // markEmailVerified
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: "a".repeat(64) });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Email verified successfully");
    });

    it("should return 400 for invalid token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: "invalid-token" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid or expired");
    });

    it("should return 400 for missing token", async () => {
      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  // --- POST /api/auth/resend-verification ---

  describe("POST /api/auth/resend-verification", () => {
    it("should return generic response for existing unverified user", async () => {
      // findByEmail
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, email_verified: false }],
        rowCount: 1,
      });
      // emailVerificationRepo: invalidate old tokens
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // emailVerificationRepo: insert new token
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("verification email");
      expect(sendEmail).toHaveBeenCalled();
    });

    it("should return same generic response for non-existent email", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "nonexistent@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("verification email");
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("should return generic response for already verified user", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockUserRow], // email_verified: true
        rowCount: 1,
      });

      const response = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(200);
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // --- POST /api/auth/forgot-password ---

  describe("POST /api/auth/forgot-password", () => {
    it("should send reset email for existing user", async () => {
      // findByEmail
      mockQuery.mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
      });
      // passwordResetRepo: invalidate old tokens
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // passwordResetRepo: insert new token
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("password reset email");
      expect(sendEmail).toHaveBeenCalled();
    });

    it("should return same generic response for non-existent email", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("password reset email");
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "not-valid" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  // --- POST /api/auth/reset-password ---

  describe("POST /api/auth/reset-password", () => {
    it("should reset password with valid token", async () => {
      // findValidByRawToken
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "pr-1",
            user_id: "user-123",
            token_hash: "hash",
            expires_at: new Date(Date.now() + 3600000),
            used_at: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });
      // updatePasswordHash
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // markUsed
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // revokeAllForUser
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // markEmailVerified
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "a".repeat(64), password: "NewPassword123" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Password has been reset");
    });

    it("should return 400 for invalid token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "bad-token", password: "NewPassword123" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid or expired");
    });

    it("should return 400 for weak new password", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "some-token", password: "weak" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  // --- POST /api/auth/set-password ---

  describe("POST /api/auth/set-password", () => {
    it("should set password for authenticated OAuth user", async () => {
      // findById
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            ...mockUserRow,
            password_hash: null,
            auth_provider: "google",
          },
        ],
        rowCount: 1,
      });
      // updatePasswordHash
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .post("/api/auth/set-password")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: "NewPassword123" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Password set successfully");
    });

    it("should return 409 if password already set", async () => {
      // findById - user already has password
      mockQuery.mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
      });

      const response = await request(app)
        .post("/api/auth/set-password")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: "NewPassword123" });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain("already set");
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app)
        .post("/api/auth/set-password")
        .send({ password: "NewPassword123" });

      expect(response.status).toBe(401);
    });

    it("should return 400 for weak password", async () => {
      const response = await request(app)
        .post("/api/auth/set-password")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: "weak" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  // --- Tests for existing auth endpoints ---

  describe("POST /api/auth/google", () => {
    it("should return 400 for missing idToken", async () => {
      const response = await request(app)
        .post("/api/auth/google")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh tokens with valid refresh token", async () => {
      // findValidByHash
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "rt-1",
            user_id: "user-123",
            token_hash: "hash",
            expires_at: new Date(Date.now() + 86400000),
            revoked: false,
            device_info: null,
            ip_address: null,
            created_at: new Date(),
            last_used_at: null,
          },
        ],
        rowCount: 1,
      });
      // findById (get user)
      mockQuery.mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
      });
      // revoke old token
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // create new refresh token
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "rt-2",
            user_id: "user-123",
            token_hash: "newhash",
            expires_at: new Date(),
            revoked: false,
            device_info: null,
            ip_address: null,
            created_at: new Date(),
            last_used_at: null,
          },
        ],
        rowCount: 1,
      });

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "valid-refresh-token" });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it("should return 401 for invalid refresh token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" });

      expect(response.status).toBe(401);
    });

    it("should return 400 for missing refreshToken", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout with valid refresh token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .post("/api/auth/logout")
        .send({ refreshToken: "some-refresh-token" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logged out successfully");
    });

    it("should return 400 for missing refreshToken", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/auth/logout-all", () => {
    it("should logout from all devices", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post("/api/auth/logout-all")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logged out from all devices");
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app).post("/api/auth/logout-all");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user profile", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
      });

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe("test@example.com");
      expect(response.body.name).toBe("Test User");
    });

    it("should return 404 if user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/auth/sessions", () => {
    it("should return active sessions", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "session-1",
            user_id: "user-123",
            token_hash: "hash",
            expires_at: new Date(Date.now() + 86400000),
            revoked: false,
            device_info: "Chrome",
            ip_address: "127.0.0.1",
            created_at: new Date(),
            last_used_at: new Date(),
          },
        ],
        rowCount: 1,
      });

      const response = await request(app)
        .get("/api/auth/sessions")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe("session-1");
      expect(response.body[0].deviceInfo).toBe("Chrome");
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app).get("/api/auth/sessions");

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/auth/sessions/:sessionId", () => {
    it("should revoke a specific session", async () => {
      // getActiveSessionsForUser
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            user_id: "user-123",
            token_hash: "hash",
            expires_at: new Date(Date.now() + 86400000),
            revoked: false,
            device_info: null,
            ip_address: null,
            created_at: new Date(),
            last_used_at: null,
          },
        ],
        rowCount: 1,
      });
      // revoke
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .delete(
          "/api/auth/sessions/550e8400-e29b-41d4-a716-446655440000",
        )
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Session revoked");
    });

    it("should return 404 if session not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .delete(
          "/api/auth/sessions/550e8400-e29b-41d4-a716-446655440000",
        )
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid session ID format", async () => {
      const response = await request(app)
        .delete("/api/auth/sessions/not-a-uuid")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app).delete(
        "/api/auth/sessions/550e8400-e29b-41d4-a716-446655440000",
      );

      expect(response.status).toBe(401);
    });
  });
});
