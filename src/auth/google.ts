// src/auth/google.ts
import { OAuth2Client } from "google-auth-library";
import { getEnv } from "@/config";
import { AppError } from "@/utils";

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!client) {
    const { GOOGLE_CLIENT_ID } = getEnv();
    if (!GOOGLE_CLIENT_ID) {
      throw new AppError(500, "Google OAuth not configured", "AUTH_GOOGLE_NOT_CONFIGURED");
    }
    client = new OAuth2Client(GOOGLE_CLIENT_ID);
  }
  return client;
}

export async function verifyGoogleToken(idToken: string) {
  const { GOOGLE_CLIENT_ID } = getEnv();

  if (!GOOGLE_CLIENT_ID) {
    throw new AppError(500, "Google OAuth not configured");
  }

  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new AppError(401, "Invalid Google token", "AUTH_GOOGLE_TOKEN_INVALID");
  }

  return {
    email: payload.email,
    name: payload.name || "",
  };
}
