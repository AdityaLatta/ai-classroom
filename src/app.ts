import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { getEnv } from "@/config";
import { ErrorCode, loadModules, LoadedModule, logger } from "@/utils";
import {
  errorHandler,
  apiLimiter,
  requestIdMiddleware,
  requestTimeout,
  httpLogger,
  csrfGuard,
} from "@/middlewares";
import {
  initSentry,
  setupSentryErrorHandler,
  setupSwagger,
  healthCheck,
  getMailer,
} from "@/infra";

export function createApp(): { app: express.Express; modules: LoadedModule[] } {
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
  app.use(express.json({ limit: "10kb", strict: false }));

  // ---- HTTP request logging ----
  app.use(httpLogger);

  // ---- Rate limiting ----
  app.use("/api", apiLimiter);

  // ---- CSRF protection ----
  app.use("/api", csrfGuard);

  // ---- API Documentation ----
  setupSwagger(app);

  // ---- Auto-discover and mount module routes ----
  const modules = loadModules();
  for (const mod of modules) {
    app.use(`/api/v1/${mod.prefix}`, mod.definition.router);
  }

  // ---- Health check (verifies DB + SMTP + module health) ----
  let smtpCache: { ok: boolean; checkedAt: number } | null = null;
  let moduleHealthCache: {
    results: Record<string, { ok: boolean; details?: Record<string, unknown> }>;
    checkedAt: number;
  } | null = null;
  const HEALTH_CACHE_TTL_MS = 30_000; // 30 seconds

  app.get("/health", async (req, res) => {
    const dbOk = await healthCheck();

    let smtpOk = false;
    if (smtpCache && Date.now() - smtpCache.checkedAt < HEALTH_CACHE_TTL_MS) {
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

    // Module health checks (cached)
    let moduleResults: Record<string, { ok: boolean; details?: Record<string, unknown> }> = {};
    if (moduleHealthCache && Date.now() - moduleHealthCache.checkedAt < HEALTH_CACHE_TTL_MS) {
      moduleResults = moduleHealthCache.results;
    } else {
      for (const mod of modules) {
        if (mod.definition.healthCheck) {
          try {
            moduleResults[mod.name] = await mod.definition.healthCheck();
          } catch (err) {
            logger.error({ err, module: mod.name }, "Module health check failed");
            moduleResults[mod.name] = { ok: false, details: { error: "health check threw" } };
          }
        }
      }
      moduleHealthCache = { results: moduleResults, checkedAt: Date.now() };
    }

    const modulesOk = Object.values(moduleResults).every((r) => r.ok);
    const allOk = dbOk && smtpOk && modulesOk;
    const status = allOk ? "ok" : dbOk ? "degraded" : "error";

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
        modules: moduleResults,
      });
  });

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

  return { app, modules };
}
