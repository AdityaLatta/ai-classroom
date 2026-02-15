import { Logger } from "../utils/logger";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      role: string;
      email: string;
    };
    requestId: string;
    log: Logger;
    validated: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
  }
}
