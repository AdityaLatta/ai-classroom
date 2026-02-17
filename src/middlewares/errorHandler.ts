import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, logger } from "@/utils";
import { captureError } from "@/infra";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;
  const log = req.log || logger;

  if (err instanceof ZodError) {
    log.warn({ requestId }, "Zod validation error leaked to error handler");
    res.status(400).json({
      error: "Validation failed",
      requestId,
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    // Operational errors - expected errors we can handle
    if (err.statusCode >= 500) {
      log.error(
        { err, requestId, statusCode: err.statusCode },
        "Operational error",
      );
      captureError(err, { requestId, isOperational: true });
    } else {
      log.warn({ requestId, statusCode: err.statusCode }, err.message);
    }

    const body: Record<string, unknown> = {
      error: err.message,
      requestId,
    };
    if (err.code) body.code = err.code;

    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected errors - bugs we need to fix
  const error = err instanceof Error ? err : new Error(String(err));

  log.error(
    {
      err: error,
      requestId,
      stack: error.stack,
    },
    "Unexpected error",
  );

  // Capture in Sentry with full context
  captureError(error, {
    requestId,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
  });

  res.status(500).json({
    error: "Internal Server Error",
    requestId,
  });
}
