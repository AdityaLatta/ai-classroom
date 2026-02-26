import { getEnv } from "@/config";
import { AppError, ErrorCode, logger } from "@/utils";
import { eventBus } from "@/infra/eventBus";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class LoginAttemptTracker {
  private attempts = new Map<string, { count: number; lockedUntil: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  check(email: string): void {
    const entry = this.attempts.get(email);
    if (!entry) return;

    const now = Date.now();

    if (entry.lockedUntil > now) {
      const minutesLeft = Math.ceil((entry.lockedUntil - now) / 60000);
      eventBus.emit("auth:account-locked-check", { email, minutesLeft });
      throw new AppError(
        429,
        `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
        ErrorCode.AUTH_ACCOUNT_LOCKED,
      );
    }

    // Lock expired, clear it
    this.attempts.delete(email);
  }

  recordFailure(email: string, ip?: string): void {
    const { LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MINUTES } = getEnv();
    const entry = this.attempts.get(email) || { count: 0, lockedUntil: 0 };
    entry.count++;

    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000;
      this.attempts.set(email, entry);

      eventBus.emit("auth:account-locked", {
        email,
        ip,
        attempts: entry.count,
        lockoutMinutes: LOGIN_LOCKOUT_MINUTES,
      });

      logger.warn(
        { email, attempts: entry.count },
        "Account locked due to failed login attempts",
      );
      return;
    }

    this.attempts.set(email, entry);

    eventBus.emit("auth:login-failed", {
      email,
      ip,
      attemptNumber: entry.count,
    });
  }

  clear(email: string): void {
    this.attempts.delete(email);
  }

  getSize(): number {
    return this.attempts.size;
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
        // Expired lockout
        this.attempts.delete(email);
      } else if (entry.lockedUntil === 0) {
        // Sub-threshold failure entries with no active lockout — purge to prevent unbounded growth
        this.attempts.delete(email);
      }
    }
  }
}
