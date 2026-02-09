import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger";

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  logger.warn(
    "Rate limiter is using in-memory store. " +
      "Set REDIS_URL and use rate-limit-redis for multi-instance deployments.",
  );
}

function createLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export const apiLimiter = createLimiter(
  15 * 60 * 1000,
  100,
  "Too many requests, please try again later",
);

export const authLimiter = createLimiter(
  15 * 60 * 1000,
  10,
  "Too many authentication attempts, please try again later",
);

export const strictLimiter = createLimiter(
  60 * 60 * 1000,
  5,
  "Rate limit exceeded for this operation",
);
