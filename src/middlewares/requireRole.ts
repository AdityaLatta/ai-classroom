import { Request, Response, NextFunction } from "express";
import { ErrorCode } from "../utils/errorCodes";

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: "Forbidden",
        code: ErrorCode.AUTH_FORBIDDEN,
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}
