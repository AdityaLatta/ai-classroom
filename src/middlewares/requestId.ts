import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { createChildLogger } from "../utils/logger";

export const REQUEST_ID_HEADER = "X-Request-ID";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const clientId = req.headers[REQUEST_ID_HEADER.toLowerCase()] as
    | string
    | undefined;

  // Only trust client-provided ID if it's a valid UUID
  const requestId =
    clientId && UUID_REGEX.test(clientId) ? clientId : randomUUID();

  req.requestId = requestId;

  req.log = createChildLogger({
    requestId,
    method: req.method,
    url: req.url,
  });

  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}
