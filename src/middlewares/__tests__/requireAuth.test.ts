import { Request, Response, NextFunction } from "express";
import { requireAuth } from "../requireAuth";
import { signAccessToken, JwtPayload } from "../../auth/jwt";

describe("requireAuth middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const validPayload: JwtPayload = {
    sub: "user-123",
    role: "STUDENT",
    email: "test@example.com",
  };

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
  });

  it("should return 401 if no authorization header", () => {
    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 if authorization header does not start with Bearer", () => {
    mockRequest.headers = { authorization: "Basic token123" };

    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 for invalid token", () => {
    mockRequest.headers = { authorization: "Bearer invalid-token" };

    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid or expired token", code: "AUTH_ACCESS_TOKEN_INVALID" }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should call next() and attach user for valid token", () => {
    const token = signAccessToken(validPayload);
    mockRequest.headers = { authorization: `Bearer ${token}` };

    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
    expect(mockRequest.user).toEqual({
      id: validPayload.sub,
      role: validPayload.role,
      email: validPayload.email,
    });
  });

  it("should correctly set user properties from token", () => {
    const payload: JwtPayload = {
      sub: "admin-456",
      role: "ADMIN",
      email: "admin@example.com",
    };
    const token = signAccessToken(payload);
    mockRequest.headers = { authorization: `Bearer ${token}` };

    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockRequest.user).toEqual({
      id: "admin-456",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("should handle Bearer with extra whitespace", () => {
    const token = signAccessToken(validPayload);
    mockRequest.headers = { authorization: `Bearer  ${token}` };

    // This should fail because of extra space
    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    // Extra space means token starts with space, which is invalid
    expect(statusMock).toHaveBeenCalledWith(401);
  });
});
