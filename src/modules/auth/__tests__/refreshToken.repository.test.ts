import { RefreshTokenRepository } from "@/modules/auth/refreshToken.repository";

const mockQuery = jest.fn();

jest.mock("@/infra/db", () => ({
  getDb: jest.fn(() => ({
    query: mockQuery,
  })),
}));

describe("RefreshTokenRepository", () => {
  let repo: RefreshTokenRepository;

  const mockTokenRow = {
    id: "rt-1",
    user_id: "user-123",
    token_hash: "abc123hash",
    expires_at: new Date(Date.now() + 86400000),
    revoked: false,
    device_info: "Chrome",
    ip_address: "127.0.0.1",
    created_at: new Date(),
    last_used_at: new Date(),
  };

  beforeEach(() => {
    repo = new RefreshTokenRepository();
    mockQuery.mockReset();
  });

  describe("create", () => {
    it("should store a new refresh token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockTokenRow], rowCount: 1 });

      const result = await repo.create({
        userId: "user-123",
        tokenHash: "abc123hash",
        deviceInfo: "Chrome",
        ipAddress: "127.0.0.1",
      });

      expect(result.id).toBe("rt-1");
      expect(result.userId).toBe("user-123");
      expect(mockQuery.mock.calls[0][0]).toContain("INSERT INTO refresh_tokens");
    });

    it("should handle optional fields", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockTokenRow, device_info: null, ip_address: null }],
        rowCount: 1,
      });

      const result = await repo.create({
        userId: "user-123",
        tokenHash: "abc123hash",
      });

      expect(result.deviceInfo).toBeNull();
      expect(result.ipAddress).toBeNull();
    });
  });

  describe("findValidByHash", () => {
    it("should return valid token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockTokenRow], rowCount: 1 });

      const result = await repo.findValidByHash("abc123hash");

      expect(result).not.toBeNull();
      expect(result!.tokenHash).toBe("abc123hash");
    });

    it("should return null for invalid token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findValidByHash("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("updateLastUsed", () => {
    it("should update last_used_at timestamp", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await repo.updateLastUsed("rt-1");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("last_used_at = NOW()"),
        ["rt-1"],
      );
    });
  });

  describe("revoke", () => {
    it("should revoke a specific token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await repo.revoke("rt-1");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("revoked = true"),
        ["rt-1"],
      );
    });
  });

  describe("revokeByHash", () => {
    it("should revoke token by hash", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await repo.revokeByHash("abc123hash");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("token_hash"),
        ["abc123hash"],
      );
    });
  });

  describe("revokeAllForUser", () => {
    it("should revoke all tokens for user", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 });

      await repo.revokeAllForUser("user-123");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("user_id"),
        ["user-123"],
      );
    });
  });

  describe("deleteExpired", () => {
    it("should delete expired tokens and return count", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "1" }, { id: "2" }],
        rowCount: 2,
      });

      const count = await repo.deleteExpired();

      expect(count).toBe(2);
      expect(mockQuery.mock.calls[0][0]).toContain("DELETE FROM refresh_tokens");
    });

    it("should return 0 when no expired tokens", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const count = await repo.deleteExpired();

      expect(count).toBe(0);
    });
  });

  describe("getActiveSessionsForUser", () => {
    it("should return active sessions", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockTokenRow],
        rowCount: 1,
      });

      const sessions = await repo.getActiveSessionsForUser("user-123");

      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe("user-123");
      expect(sessions[0].deviceInfo).toBe("Chrome");
    });

    it("should return empty array when no sessions", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const sessions = await repo.getActiveSessionsForUser("user-123");

      expect(sessions).toHaveLength(0);
    });
  });
});
