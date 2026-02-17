import http from "http";
import { createApp } from "@/app";
import { loadEnv, getEnv } from "@/config";
import { initDb, closeDb, initWebSocket } from "@/infra";
import { initLogger, logger } from "@/utils";
import { authModule } from "@/modules/auth/auth.module";

async function startServer() {
  loadEnv();
  initLogger();
  await initDb();

  const app = createApp();
  const server = http.createServer(app);

  initWebSocket(server);
  authModule.start();

  const { PORT, SHUTDOWN_TIMEOUT_MS } = getEnv();

  server.listen(PORT, () => {
    logger.info({ port: PORT }, "Server started");
  });

  let isShuttingDown = false;

  function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, "Graceful shutdown initiated");
    authModule.stop();

    // Force exit after timeout to prevent hanging
    const forceTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    // Stop accepting new connections, then drain existing
    server.close(async () => {
      try {
        await closeDb();
        logger.info("Server stopped gracefully");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during shutdown");
        process.exit(1);
      }
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
