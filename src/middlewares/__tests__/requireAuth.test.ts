import { Request, Response } from "express";
import { requireAuth } from "../requireAuth";
import { signAccessToken, JwtPayload } from "../../auth/jwt";
import { AppError } from "../../utils/AppError";

describe("requireAuth middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  const validPayload: JwtPayload = {
    sub: "user-123",
    role: "STUDENT",
    email: "test@example.com",
  };

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  it("should call next with AppError(401) if no authorization header", () => {
    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = mockNext.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Unauthorized");
    expect(error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("should call next with AppError(401) if authorization header does not start with Bearer", () => {
    mockRequest.headers = { authorization: "Basic token123" };

    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = mockNext.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("should call next with AppError(401) for invalid token", () => {
    mockRequest.headers = { authorization: "Bearer invalid-token" };

    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = mockNext.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Invalid or expired token");
    expect(error.code).toBe("AUTH_ACCESS_TOKEN_INVALID");
  });

  it("should call next() and attach user for valid token", () => {
    const token = signAccessToken(validPayload);
    mockRequest.headers = { authorization: `Bearer ${token}` };

    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
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

    // Extra space means token starts with space, which is invalid
    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = mockNext.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(401);
  });
});
