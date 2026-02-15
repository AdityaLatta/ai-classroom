import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { ErrorCode } from "../utils/errorCodes";

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      next(new AppError(403, "Forbidden", ErrorCode.AUTH_FORBIDDEN));
      return;
    }

    next();
  };
}
