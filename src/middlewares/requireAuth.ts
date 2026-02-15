import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth/jwt";
import { ErrorCode } from "../utils/errorCodes";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      code: ErrorCode.AUTH_UNAUTHORIZED,
      requestId: req.requestId,
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      code: ErrorCode.AUTH_UNAUTHORIZED,
      requestId: req.requestId,
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };

    next();
  } catch {
    res.status(401).json({
      error: "Invalid or expired token",
      code: ErrorCode.AUTH_ACCESS_TOKEN_INVALID,
      requestId: req.requestId,
    });
  }
}
