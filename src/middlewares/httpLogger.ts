import { Request, Response, NextFunction } from "express";

export function httpLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const log = req.log;

    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      userId: req.user?.id,
    };

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
