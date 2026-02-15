import { Request, Response, NextFunction } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Lightweight CSRF protection: requires a custom `X-Requested-With` header
 * on all state-changing requests. Custom headers trigger a CORS preflight,
 * which blocks cross-origin form submissions from attacker sites.
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (req.headers["x-requested-with"]) {
    next();
    return;
  }

  res.status(403).json({
    error: "Forbidden",
    message: "Missing X-Requested-With header",
    requestId: req.requestId,
  });
}
