import express from "express";
import cors from "cors";
import helmet from "helmet";

import { getEnv } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { courseRouter } from "./modules/courses/course.routes";
import { errorHandler } from "./middlewares/errorHandler";
import { apiLimiter } from "./middlewares/rateLimiter";
import { requestIdMiddleware } from "./middlewares/requestId";
import { requestTimeout } from "./middlewares/requestTimeout";
import { httpLogger } from "./middlewares/httpLogger";
import { initSentry, setupSentryErrorHandler } from "./infra/sentry";
import { setupSwagger } from "./infra/swagger";
import { healthCheck } from "./infra/db";

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
  app.use(
    cors({
      origin:
        env.NODE_ENV === "production" ? env.FRONTEND_URL : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10kb" }));

  // ---- HTTP request logging ----
  app.use(httpLogger);

  // ---- Rate limiting ----
  app.use("/api", apiLimiter);

  // ---- API Documentation ----
  setupSwagger(app);

  // ---- Health check (verifies DB connectivity) ----
  app.get("/health", async (req, res) => {
    const dbOk = await healthCheck();
    const status = dbOk ? "ok" : "degraded";
    res
      .status(dbOk ? 200 : 503)
      .json({ status, requestId: req.requestId });
  });

  // ---- API routes ----
  app.use("/api/auth", authRouter);
  app.use("/api/courses", courseRouter);

  // ---- 404 ----
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", requestId: req.requestId });
  });

  // ---- Sentry error handler (before custom error handler) ----
  setupSentryErrorHandler(app);

  // ---- Error handler (last) ----
  app.use(errorHandler);

  return app;
}
