import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

function createValidator(
  extract: (req: Request) => unknown,
  assign: (req: Request, parsed: unknown) => void,
) {
  return (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
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
            details: errors,
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
  },
);

export const validateQuery = createValidator(
  (req) => req.query,
  () => {
    // Express 5 req.query is a read-only getter; validated, but not reassigned
  },
);

export const validateParams = createValidator(
  (req) => req.params,
  () => {
    // Express 5 req.params is read-only; validated, but not reassigned
  },
);
