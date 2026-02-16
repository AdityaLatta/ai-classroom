import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { getEnv } from "./config/env";
import { authRouter } from "./modules/auth/auth.module";
import { courseRouter } from "./modules/courses/course.module";
import { errorHandler } from "./middlewares/errorHandler";
import { apiLimiter } from "./middlewares/rateLimiter";
import { requestIdMiddleware } from "./middlewares/requestId";
import { requestTimeout } from "./middlewares/requestTimeout";
import { httpLogger } from "./middlewares/httpLogger";
import { initSentry, setupSentryErrorHandler } from "./infra/sentry";
import { setupSwagger } from "./infra/swagger";
import { healthCheck } from "./infra/db";
import { getMailer } from "./infra/mailer";
import { csrfGuard } from "./middlewares/csrf";
import { ErrorCode } from "./utils/errorCodes";

export function createApp() {
  const app = express();
  const env = getEnv();

  // ---- Sentry must be first ----
  initSentry(app);

  // ---- Request ID for tracing ----
  app.use(requestIdMiddleware);

  // ---- Request timeout ----
  app.use(requestTimeout);

  // ---- Core middleware (order matters) ----
  app.use(helmet());

  // CORS with multiple origins support
  const corsOrigins =
    env.NODE_ENV === "production"
      ? env.CORS_ORIGINS || [env.FRONTEND_URL]
      : true;

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "10kb" }));

  // ---- HTTP request logging ----
  app.use(httpLogger);

  // ---- Rate limiting ----
  app.use("/api", apiLimiter);

  // ---- CSRF protection ----
  app.use("/api", csrfGuard);

  // ---- API Documentation ----
  setupSwagger(app);

  // ---- Health check (verifies DB + SMTP connectivity) ----
  let smtpCache: { ok: boolean; checkedAt: number } | null = null;
  const SMTP_CACHE_TTL_MS = 30_000; // 30 seconds

  app.get("/health", async (req, res) => {
    const dbOk = await healthCheck();

    let smtpOk = false;
    if (smtpCache && Date.now() - smtpCache.checkedAt < SMTP_CACHE_TTL_MS) {
      smtpOk = smtpCache.ok;
    } else {
      try {
        await getMailer().verify();
        smtpOk = true;
      } catch {
        // SMTP is not reachable
      }
      smtpCache = { ok: smtpOk, checkedAt: Date.now() };
    }

    const allOk = dbOk && smtpOk;
    const status = allOk ? "ok" : "degraded";

    res
      .status(dbOk ? 200 : 503)
      .json({
        status,
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        components: {
          database: dbOk ? "ok" : "error",
          smtp: smtpOk ? "ok" : "error",
        },
      });
  });

  // ---- API v1 routes ----
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/courses", courseRouter);

  // ---- Backward-compatible routes (deprecated, alias to v1) ----
  const deprecation: express.RequestHandler = (_req, res, next) => {
    res.set("Deprecation", "true");
    res.set("Sunset", "2026-12-31T23:59:59Z");
    res.set("Link", '</api/v1/>; rel="successor-version"');
    next();
  };
  app.use("/api/auth", deprecation, authRouter);
  app.use("/api/courses", deprecation, courseRouter);

  // ---- 404 ----
  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      code: ErrorCode.NOT_FOUND,
      requestId: req.requestId,
    });
  });

  // ---- Sentry error handler (before custom error handler) ----
  setupSentryErrorHandler(app);

  // ---- Error handler (last) ----
  app.use(errorHandler);

  return app;
}
