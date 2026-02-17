import { getEnv } from "@/config";
import { AppError, ErrorCode, audit, logger } from "@/utils";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class LoginAttemptTracker {
  private attempts = new Map<string, { count: number; lockedUntil: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  check(email: string): void {
    const entry = this.attempts.get(email);
    if (!entry) return;

    if (entry.lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      audit({ action: "ACCOUNT_LOCKED", email, metadata: { minutesLeft } });
      throw new AppError(
        429,
        `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
        ErrorCode.AUTH_ACCOUNT_LOCKED,
      );
    }

    // Lock expired, clear it
    if (entry.lockedUntil <= Date.now()) {
      this.attempts.delete(email);
    }
  }

  recordFailure(email: string, ip?: string): void {
    const { LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MINUTES } = getEnv();
    const entry = this.attempts.get(email) || { count: 0, lockedUntil: 0 };
    entry.count++;

    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000;
      this.attempts.set(email, entry);

      audit({
        action: "ACCOUNT_LOCKED",
        email,
        ip,
        metadata: { attempts: entry.count, lockoutMinutes: LOGIN_LOCKOUT_MINUTES },
      });

      logger.warn(
        { email, attempts: entry.count },
        "Account locked due to failed login attempts",
      );
      return;
    }

    this.attempts.set(email, entry);

    audit({
      action: "USER_LOGIN_FAILED",
      email,
      ip,
      metadata: { attemptNumber: entry.count },
    });
  }

  clear(email: string): void {
    this.attempts.delete(email);
  }

  startCleanup(): void {
    this.cleanupTimer = setInterval(() => this.evictExpired(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [email, entry] of this.attempts) {
      if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
        this.attempts.delete(email);
      }
    }
  }
}
