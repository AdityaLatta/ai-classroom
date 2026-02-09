import http from "http";
import { createApp } from "./app";
import { loadEnv, getEnv } from "./config/env";
import { initDb, closeDb } from "./infra/db";
import { initWebSocket } from "./infra/websocket";
import { initLogger, logger } from "./utils/logger";
import { startTokenCleanup, stopTokenCleanup } from "./jobs/tokenCleanup";

async function startServer() {
  loadEnv();
  initLogger();
  await initDb();

  const app = createApp();
  const server = http.createServer(app);

  initWebSocket(server);
  startTokenCleanup();

  const { PORT } = getEnv();

  server.listen(PORT, () => {
    logger.info({ port: PORT }, "Server started");
  });

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  function shutdown() {
    logger.info("Shutting down server...");
    stopTokenCleanup();
    server.close(async () => {
      await closeDb();
      logger.info("Server stopped");
      process.exit(0);
    });
  }
}

startServer().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
