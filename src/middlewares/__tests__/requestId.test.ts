import { Request, Response } from "express";
import { requestIdMiddleware, REQUEST_ID_HEADER } from "../requestId";

jest.mock("../../utils/logger", () => ({
  createChildLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("requestIdMiddleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    setHeaderMock = jest.fn();
    mockRequest = {
      headers: {},
      method: "GET",
      url: "/test",
    };
    mockResponse = {
      setHeader: setHeaderMock,
    };
    mockNext = jest.fn();
  });

  it("should generate a UUID request ID when none provided", () => {
    requestIdMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockRequest.requestId).toBeDefined();
    expect(UUID_REGEX.test(mockRequest.requestId!)).toBe(true);
    expect(setHeaderMock).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      mockRequest.requestId,
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it("should use client-provided UUID if valid", () => {
    const clientId = "550e8400-e29b-41d4-a716-446655440000";
    mockRequest.headers = { "x-request-id": clientId };

    requestIdMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockRequest.requestId).toBe(clientId);
    expect(setHeaderMock).toHaveBeenCalledWith(REQUEST_ID_HEADER, clientId);
  });

  it("should reject non-UUID client header and generate new ID", () => {
    mockRequest.headers = { "x-request-id": "not-a-uuid" };

    requestIdMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockRequest.requestId).not.toBe("not-a-uuid");
    expect(UUID_REGEX.test(mockRequest.requestId!)).toBe(true);
  });

  it("should set response header with request ID", () => {
    requestIdMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(setHeaderMock).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      expect.any(String),
    );
  });

  it("should attach a child logger to req.log", () => {
    requestIdMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockRequest.log).toBeDefined();
  });
});
