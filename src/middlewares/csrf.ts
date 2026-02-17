import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";
import { ErrorCode } from "@/utils/errorCodes";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Lightweight CSRF protection: requires a custom `X-Requested-With` header
 * on all state-changing requests. Custom headers trigger a CORS preflight,
 * which blocks cross-origin form submissions from attacker sites.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (req.headers["x-requested-with"]) {
    next();
    return;
  }

  next(new AppError(403, "Missing X-Requested-With header", ErrorCode.CSRF_HEADER_MISSING));
}
