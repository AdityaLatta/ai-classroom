import * as Sentry from "@sentry/node";
import { Express } from "express";
import { getEnv } from "@/config/env";
import { logger } from "@/utils/logger";

let initialized = false;

export function initSentry(_app: Express): void {
  const { SENTRY_DSN, NODE_ENV } = getEnv();

  if (!SENTRY_DSN) {
    logger.warn("SENTRY_DSN not configured, error tracking disabled");
    return;
  }

  if (initialized) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    // Performance monitoring - sample 10% in production
    tracesSampleRate: NODE_ENV === "production" ? 0.1 : 1.0,
    // Don't send in test environment
    enabled: NODE_ENV !== "test",
  });

  initialized = true;
  logger.info("Sentry initialized");
}

export function setupSentryErrorHandler(app: Express): void {
  const { SENTRY_DSN } = getEnv();

  if (!SENTRY_DSN) {
    return;
  }

  // Set up the Sentry Express error handler
  Sentry.setupExpressErrorHandler(app);
}

export function captureError(
  error: Error,
  context?: Record<string, unknown>,
): void {
  const { SENTRY_DSN } = getEnv();

  if (!SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

export function setUserContext(user: {
  id: string;
  email?: string;
  role?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}

export { Sentry };
