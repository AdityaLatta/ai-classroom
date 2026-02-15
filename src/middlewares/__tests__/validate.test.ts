import { Request, Response } from "express";
import { z } from "zod";
import { validate, validateQuery, validateParams } from "../validate";

describe("validate middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      body: {},
      query: {},
      params: {},
      requestId: "test-request-id",
      validated: {} as any,
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
  });

  describe("validate (body)", () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    });

    it("should pass valid body and call next", () => {
      mockRequest.body = { name: "Alice", age: 25 };

      validate(schema)(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.body).toEqual({ name: "Alice", age: 25 });
      expect(mockRequest.validated!.body).toEqual({ name: "Alice", age: 25 });
    });

    it("should return 400 for invalid body", () => {
      mockRequest.body = { name: "", age: -1 };

      validate(schema)(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: expect.any(Array),
        }),
      );
    });

    it("should strip unknown keys", () => {
      const strictSchema = z.object({ name: z.string() }).strict();
      mockRequest.body = { name: "Bob", extra: "field" };

      validate(strictSchema)(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("validateQuery", () => {
    const schema = z.object({
      page: z.coerce.number().int().positive().optional().default(1),
    });

    it("should parse and assign validated query", () => {
      mockRequest.query = { page: "3" } as any;

      validateQuery(schema)(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.validated!.query).toEqual({ page: 3 });
    });

    it("should return 400 for invalid query", () => {
      mockRequest.query = { page: "abc" } as any;

      validateQuery(schema)(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("validateParams", () => {
    const schema = z.object({
      id: z.string().uuid(),
    });

    it("should parse and assign validated params", () => {
      mockRequest.params = { id: "550e8400-e29b-41d4-a716-446655440000" } as any;

      validateParams(schema)(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.validated!.params).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
    });

    it("should return 400 for invalid params", () => {
      mockRequest.params = { id: "not-a-uuid" } as any;

      validateParams(schema)(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });
});
