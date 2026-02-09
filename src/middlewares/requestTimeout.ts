import { Request, Response, NextFunction } from "express";
import { getEnv } from "../config/env";

export function requestTimeout(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { REQUEST_TIMEOUT_MS } = getEnv();
  req.setTimeout(REQUEST_TIMEOUT_MS);
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Request Timeout", requestId: req.requestId });
    }
  });
  next();
}
