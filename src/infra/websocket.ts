import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { verifyAccessToken } from "../auth/jwt";
import { logger, createChildLogger } from "../utils/logger";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  role?: string;
}

export function initWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });

  wss.on("connection", (socket: AuthenticatedSocket, request) => {
    try {
      // Example: token passed as query param
      const url = new URL(request.url || "", "http://localhost");
      const token = url.searchParams.get("token");

      if (!token) {
        socket.close(1008, "Unauthorized");
        return;
      }

      const payload = verifyAccessToken(token);

      socket.userId = payload.sub;
      socket.role = payload.role;

      const wsLogger = createChildLogger({
        component: "websocket",
        userId: socket.userId,
      });

      wsLogger.info("WebSocket connected");

      socket.on("message", (message) => {
        handleMessage(socket, message.toString());
      });

      socket.on("close", () => {
        wsLogger.info("WebSocket disconnected");
      });

      socket.on("error", (err) => {
        wsLogger.error({ err }, "WebSocket error");
      });
    } catch {
      socket.close(1008, "Invalid token");
    }
  });

  logger.info("WebSocket server initialized");
}

function handleMessage(socket: AuthenticatedSocket, raw: string) {
  let msg: { type?: string };
  try {
    msg = JSON.parse(raw);
  } catch {
    socket.send(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  switch (msg.type) {
    case "JOIN_ROOM":
      break;

    case "WEBRTC_OFFER":
      break;

    case "CHAT_MESSAGE":
      break;
  }
}
