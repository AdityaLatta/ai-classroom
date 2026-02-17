import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ErrorCode } from "@/utils";

function ensureValidated(req: Request): void {
  if (!req.validated) {
    req.validated = {};
  }
}

function createValidator(
  extract: (req: Request) => unknown,
  assign: (req: Request, parsed: unknown) => void,
) {
  return (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        ensureValidated(req);
        const parsed = schema.parse(extract(req));
        assign(req, parsed);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          const errors = error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }));
          res.status(400).json({
            error: "Validation failed",
            code: ErrorCode.VALIDATION_ERROR,
            details: errors,
            requestId: req.requestId,
          });
          return;
        }
        next(error);
      }
    };
  };
}

export const validate = createValidator(
  (req) => req.body,
  (req, parsed) => {
    req.body = parsed;
    req.validated.body = parsed;
  },
);

export const validateQuery = createValidator(
  (req) => req.query,
  (req, parsed) => {
    // Express 5 req.query is a read-only getter; store parsed values on req.validated
    req.validated.query = parsed;
  },
);

export const validateParams = createValidator(
  (req) => req.params,
  (req, parsed) => {
    // Express 5 req.params is read-only; store parsed values on req.validated
    req.validated.params = parsed;
  },
);
