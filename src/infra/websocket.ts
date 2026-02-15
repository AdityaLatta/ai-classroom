import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { verifyAccessToken } from "../auth/jwt";
import { logger, createChildLogger } from "../utils/logger";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  role?: string;
  isAuthenticated?: boolean;
}

const AUTH_TIMEOUT_MS = 5000;

export function initWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });

  wss.on("connection", (socket: AuthenticatedSocket) => {
    socket.isAuthenticated = false;

    // Require authentication via first message within timeout
    const authTimer = setTimeout(() => {
      if (!socket.isAuthenticated) {
        socket.close(1008, "Authentication timeout");
      }
    }, AUTH_TIMEOUT_MS);

    socket.on("message", (message) => {
      const raw = message.toString();

      // First message must be auth
      if (!socket.isAuthenticated) {
        clearTimeout(authTimer);
        try {
          const msg = JSON.parse(raw);
          if (msg.type !== "AUTH" || !msg.token) {
            socket.close(1008, "First message must be AUTH with token");
            return;
          }

          const payload = verifyAccessToken(msg.token);
          socket.userId = payload.sub;
          socket.role = payload.role;
          socket.isAuthenticated = true;

          const wsLogger = createChildLogger({
            component: "websocket",
            userId: socket.userId,
          });

          wsLogger.info("WebSocket authenticated");

          socket.send(JSON.stringify({ type: "AUTH_OK" }));

          // Re-attach message handler for subsequent messages
          socket.on("message", (msg) => handleMessage(socket, msg.toString()));
        } catch {
          socket.close(1008, "Invalid token");
        }
        return;
      }
    });

    socket.on("close", () => {
      clearTimeout(authTimer);
      if (socket.userId) {
        const wsLogger = createChildLogger({
          component: "websocket",
          userId: socket.userId,
        });
        wsLogger.info("WebSocket disconnected");
      }
    });

    socket.on("error", (err) => {
      logger.error({ err, userId: socket.userId }, "WebSocket error");
    });
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
    case "WEBRTC_OFFER":
    case "CHAT_MESSAGE":
      // TODO: Implement room join, WebRTC signaling, and chat message handling
      socket.send(JSON.stringify({ error: "Not implemented yet" }));
      break;

    default:
      socket.send(JSON.stringify({ error: "Unknown message type" }));
  }
}
