import { Request, Response, NextFunction } from "express";
import { errorHandler } from "@/middlewares/errorHandler";
import { AppError } from "@/utils/AppError";

jest.mock("@/infra/sentry", () => ({
  captureError: jest.fn(),
}));

describe("errorHandler middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      requestId: "test-request-id",
      log: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        fatal: jest.fn(),
        trace: jest.fn(),
      } as unknown as Request["log"],
      originalUrl: "/api/test",
      method: "GET",
      user: { id: "user-123", role: "STUDENT", email: "test@example.com" },
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
  });

  it("should handle AppError with client error status", () => {
    const error = new AppError(400, "Bad request");

    errorHandler(
      error,
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Bad request",
      requestId: "test-request-id",
    });
  });

  it("should handle AppError with server error status", () => {
    const error = new AppError(500, "Internal error");

    errorHandler(
      error,
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Internal error",
      requestId: "test-request-id",
    });
    expect(mockRequest.log!.error).toHaveBeenCalled();
  });

  it("should handle unexpected Error objects", () => {
    const error = new Error("Something went wrong");

    errorHandler(
      error,
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Internal Server Error",
      requestId: "test-request-id",
    });
  });

  it("should handle non-Error objects", () => {
    errorHandler(
      "string error",
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Internal Server Error",
      requestId: "test-request-id",
    });
  });

  it("should handle AppError 404", () => {
    const error = new AppError(404, "Not found");

    errorHandler(
      error,
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Not found",
      requestId: "test-request-id",
    });
    expect(mockRequest.log!.warn).toHaveBeenCalled();
  });
});
