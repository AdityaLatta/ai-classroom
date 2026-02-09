import { getDb } from "../infra/db";
import { logger } from "../utils/logger";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let intervalId: ReturnType<typeof setInterval> | null = null;

async function cleanExpiredTokens(): Promise<void> {
  try {
    const db = getDb();

    const refreshResult = await db.query(
      `DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id`,
    );
    const emailResult = await db.query(
      `DELETE FROM email_verification_tokens WHERE expires_at < NOW() RETURNING id`,
    );
    const resetResult = await db.query(
      `DELETE FROM password_reset_tokens WHERE expires_at < NOW() RETURNING id`,
    );

    const total =
      (refreshResult.rowCount || 0) +
      (emailResult.rowCount || 0) +
      (resetResult.rowCount || 0);

    if (total > 0) {
      logger.info(
        {
          refreshTokens: refreshResult.rowCount,
          emailVerificationTokens: emailResult.rowCount,
          passwordResetTokens: resetResult.rowCount,
        },
        "Expired tokens cleaned up",
      );
    }
  } catch (error) {
    logger.error({ err: error }, "Token cleanup failed");
  }
}

export function startTokenCleanup(): void {
  cleanExpiredTokens();
  intervalId = setInterval(cleanExpiredTokens, CLEANUP_INTERVAL_MS);
  logger.info("Token cleanup job started (interval: 1h)");
}

export function stopTokenCleanup(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
