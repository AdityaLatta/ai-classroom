import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/auth/jwt";
import { AppError } from "@/utils/AppError";
import { ErrorCode } from "@/utils/errorCodes";

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "Unauthorized", ErrorCode.AUTH_UNAUTHORIZED);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AppError(401, "Unauthorized", ErrorCode.AUTH_UNAUTHORIZED);
    }

    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(401, "Invalid or expired token", ErrorCode.AUTH_ACCESS_TOKEN_INVALID));
  }
}
