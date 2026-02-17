import { getDb } from "@/infra/db";
import { logger } from "@/utils/logger";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Advisory lock key — arbitrary fixed integer to prevent concurrent cleanup across instances
const CLEANUP_LOCK_KEY = 123456789;

interface ExpirableTokenRepository {
  deleteExpired(): Promise<number>;
}

export class TokenCleanupJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly refreshTokenRepo: ExpirableTokenRepository,
    private readonly emailVerificationRepo: ExpirableTokenRepository,
    private readonly passwordResetRepo: ExpirableTokenRepository,
  ) {}

  start(): void {
    this.clean();
    this.intervalId = setInterval(() => this.clean(), CLEANUP_INTERVAL_MS);
    logger.info("Token cleanup job started (interval: 1h)");
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async clean(): Promise<void> {
    try {
      const db = getDb();

      // Try to acquire advisory lock — returns false if another instance holds it
      const lockResult = await db.query(
        "SELECT pg_try_advisory_lock($1) AS acquired",
        [CLEANUP_LOCK_KEY],
      );
      const acquired = lockResult.rows[0]?.acquired;

      if (!acquired) {
        logger.debug("Token cleanup skipped — another instance holds the lock");
        return;
      }

      try {
        const refreshCount = await this.refreshTokenRepo.deleteExpired();
        const emailCount = await this.emailVerificationRepo.deleteExpired();
        const resetCount = await this.passwordResetRepo.deleteExpired();

        const total = refreshCount + emailCount + resetCount;

        if (total > 0) {
          logger.info(
            {
              refreshTokens: refreshCount,
              emailVerificationTokens: emailCount,
              passwordResetTokens: resetCount,
            },
            "Expired tokens cleaned up",
          );
        }
      } finally {
        // Always release the advisory lock
        await db.query("SELECT pg_advisory_unlock($1)", [CLEANUP_LOCK_KEY]);
      }
    } catch (error) {
      logger.error({ err: error }, "Token cleanup failed");
    }
  }
}
