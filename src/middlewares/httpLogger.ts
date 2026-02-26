import { Request, Response, NextFunction } from "express";
import { logger } from "@/utils";
import { tryGetContext } from "@/infra/requestContext";

export function httpLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();

  // Capture the ALS context reference eagerly while guaranteed to be in scope.
  // The queryStats object is mutated in-place by instrumentedPool, so reading
  // it later in the "finish" callback still reflects the final accumulated stats
  // even if the ALS store becomes unreachable after the response flushes.
  const ctx = tryGetContext();

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const log = req.log ?? logger;

    const queryStats = ctx?.queryStats;

    const logData: Record<string, unknown> = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      userId: req.user?.id,
    };

    if (queryStats && queryStats.count > 0) {
      logData.queries = `${queryStats.count} queries, ${Math.round(queryStats.totalMs)}ms total`;
    }

    // Use appropriate log level based on status code
    if (res.statusCode >= 500) {
      log.error(logData, "Request failed");
    } else if (res.statusCode >= 400) {
      log.warn(logData, "Request error");
    } else {
      log.info(logData, "Request completed");
    }
  });

  next();
}
