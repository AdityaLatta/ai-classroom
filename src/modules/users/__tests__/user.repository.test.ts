import { UserRepository } from "../user.repository";

const mockQuery = jest.fn();

jest.mock("../../../infra/db", () => ({
  getDb: jest.fn(() => ({
    query: mockQuery,
  })),
}));

describe("UserRepository", () => {
  let repo: UserRepository;

  const mockUserRow = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "STUDENT",
    password_hash: "$2a$12$hash",
    email_verified: true,
    auth_provider: "email",
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
  };

  beforeEach(() => {
    repo = new UserRepository();
    mockQuery.mockReset();
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });

      const result = await repo.findById("user-123");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("user-123");
      expect(result!.email).toBe("test@example.com");
      expect(result!.passwordHash).toBe("$2a$12$hash");
      expect(result!.emailVerified).toBe(true);
      expect(result!.authProvider).toBe("email");
    });

    it("should return null when not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should return user when found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });

      const result = await repo.findByEmail("test@example.com");

      expect(result).not.toBeNull();
      expect(result!.email).toBe("test@example.com");
    });

    it("should return null when not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByEmail("no@user.com");

      expect(result).toBeNull();
    });
  });

  describe("findOrCreate", () => {
    it("should return existing user", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });

      const result = await repo.findOrCreate({
        email: "test@example.com",
        name: "Test User",
      });

      expect(result.id).toBe("user-123");
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("should create new user if not found", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, auth_provider: "google" }],
        rowCount: 1,
      });

      const result = await repo.findOrCreate({
        email: "test@example.com",
        name: "Test User",
      });

      expect(result.id).toBe("user-123");
      expect(result.authProvider).toBe("google");
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain("INSERT INTO users");
      expect(mockQuery.mock.calls[0][0]).toContain("ON CONFLICT");
      expect(mockQuery.mock.calls[0][0]).toContain("'google'");
    });
  });

  describe("createWithPassword", () => {
    it("should create user with password hash", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, auth_provider: "email", email_verified: false }],
        rowCount: 1,
      });

      const result = await repo.createWithPassword({
        email: "test@example.com",
        name: "Test User",
        passwordHash: "$2a$12$hash",
      });

      expect(result.email).toBe("test@example.com");
      expect(mockQuery.mock.calls[0][0]).toContain("INSERT INTO users");
      expect(mockQuery.mock.calls[0][0]).toContain("'email'");
    });
  });

  describe("update", () => {
    it("should update user name", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, name: "Updated Name" }],
        rowCount: 1,
      });

      const result = await repo.update("user-123", { name: "Updated Name" });

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Updated Name");
    });

    it("should update user role", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, role: "ADMIN" }],
        rowCount: 1,
      });

      const result = await repo.update("user-123", { role: "ADMIN" });

      expect(result).not.toBeNull();
      expect(result!.role).toBe("ADMIN");
    });

    it("should return existing user if no updates provided", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });

      const result = await repo.update("user-123", {});

      expect(result).not.toBeNull();
    });

    it("should return null if user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.update("nonexistent", { name: "New" });

      expect(result).toBeNull();
    });
  });

  describe("updatePasswordHash", () => {
    it("should update password hash", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await repo.updatePasswordHash("user-123", "$2a$12$newhash");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET password_hash"),
        ["$2a$12$newhash", "user-123"],
      );
    });
  });

  describe("markEmailVerified", () => {
    it("should mark user as email verified", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await repo.markEmailVerified("user-123");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("email_verified = true"),
        ["user-123"],
      );
    });
  });
});
