// src/auth/google.ts
import { OAuth2Client } from "google-auth-library";
import { getEnv } from "@/config";
import { AppError, ErrorCode } from "@/utils";
import { withRetry } from "@/utils/retry";

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!client) {
    const { GOOGLE_CLIENT_ID } = getEnv();
    if (!GOOGLE_CLIENT_ID) {
      throw new AppError(500, "Google OAuth not configured", ErrorCode.AUTH_GOOGLE_NOT_CONFIGURED);
    }
    client = new OAuth2Client(GOOGLE_CLIENT_ID);
  }
  return client;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof AppError) return false;
  // Don't retry client errors (4xx)
  const status = (error as { status?: number }).status ??
    (error as { response?: { status?: number } }).response?.status;
  if (status && status >= 400 && status < 500) return false;
  return true;
}

export async function verifyGoogleToken(idToken: string) {
  const { GOOGLE_CLIENT_ID } = getEnv();

  if (!GOOGLE_CLIENT_ID) {
    throw new AppError(500, "Google OAuth not configured", ErrorCode.AUTH_GOOGLE_NOT_CONFIGURED);
  }

  const ticket = await withRetry(
    () =>
      getClient().verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      }),
    { attempts: 3, backoff: "exponential", delayMs: 500, retryIf: isTransientError },
  );

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new AppError(401, "Invalid Google token", ErrorCode.AUTH_GOOGLE_TOKEN_INVALID);
  }

  return {
    email: payload.email,
    name: payload.name || "",
  };
}
