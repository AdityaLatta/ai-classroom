import { signAccessToken, verifyAccessToken, JwtPayload } from "../jwt";

// Use descriptive aliases matching old test names
const signToken = signAccessToken;
const verifyToken = verifyAccessToken;

describe("JWT Functions", () => {
  const validPayload: JwtPayload = {
    sub: "user-123",
    role: "STUDENT",
    email: "test@example.com",
  };

  describe("signToken", () => {
    it("should create a valid JWT token", () => {
      const token = signToken(validPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should create different tokens for different payloads", () => {
      const token1 = signToken(validPayload);
      const token2 = signToken({ ...validPayload, sub: "user-456" });

      expect(token1).not.toBe(token2);
    });

    it("should include all payload fields in token", () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);

      expect(decoded.sub).toBe(validPayload.sub);
      expect(decoded.role).toBe(validPayload.role);
      expect(decoded.email).toBe(validPayload.email);
    });
  });

  describe("verifyToken", () => {
    it("should verify and decode a valid token", () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);

      expect(decoded.sub).toBe(validPayload.sub);
      expect(decoded.role).toBe(validPayload.role);
      expect(decoded.email).toBe(validPayload.email);
    });

    it("should throw error for invalid token", () => {
      expect(() => verifyToken("invalid-token")).toThrow();
    });

    it("should throw error for tampered token", () => {
      const token = signToken(validPayload);
      const tamperedToken = token.slice(0, -5) + "xxxxx";

      expect(() => verifyToken(tamperedToken)).toThrow();
    });

    it("should throw error for token signed with different secret", () => {
      // Manually create a token with wrong secret (simulated)
      const token = signToken(validPayload);
      const parts = token.split(".");
      // Corrupt the signature
      parts[2] = "corrupted_signature";
      const corruptedToken = parts.join(".");

      expect(() => verifyToken(corruptedToken)).toThrow();
    });
  });

  describe("Token expiration", () => {
    it("should include expiration in token", () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);

      // JWT adds exp and iat fields
      expect(decoded).toHaveProperty("exp");
      expect(decoded).toHaveProperty("iat");
    });
  });

  describe("Role types", () => {
    it("should handle STUDENT role", () => {
      const payload: JwtPayload = { ...validPayload, role: "STUDENT" };
      const token = signToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.role).toBe("STUDENT");
    });

    it("should handle INSTRUCTOR role", () => {
      const payload: JwtPayload = { ...validPayload, role: "INSTRUCTOR" };
      const token = signToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.role).toBe("INSTRUCTOR");
    });

    it("should handle ADMIN role", () => {
      const payload: JwtPayload = { ...validPayload, role: "ADMIN" };
      const token = signToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.role).toBe("ADMIN");
    });
  });
});
