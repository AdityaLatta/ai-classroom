import rateLimit from "express-rate-limit";
import { ErrorCode } from "../utils/errorCodes";

function createLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    message: { error: message, code: ErrorCode.RATE_LIMIT_EXCEEDED },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        requestId: req.requestId,
      });
    },
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
