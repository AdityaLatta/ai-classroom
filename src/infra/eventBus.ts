import { logger } from "@/utils/logger";

export interface DomainEventMap {
  // Auth events
  "auth:google-login": { userId: string; email: string; ip?: string; userAgent?: string };
  "auth:login": { userId: string; email: string; ip?: string; userAgent?: string };
  "auth:login-failed": { email: string; ip?: string; attemptNumber: number };
  "auth:logout": { userId?: string };
  "auth:logout-all": { userId: string };
  "auth:token-refreshed": { userId: string; ip?: string };
  "auth:registered": { userId: string; email: string };
  "auth:email-verified": { userId: string };
  "auth:password-reset-requested": { userId: string; email: string };
  "auth:password-reset-completed": { userId: string };
  "auth:password-set": { userId: string };
  "auth:password-changed": { userId: string };
  "auth:session-revoked": { userId: string; sessionId: string };
  "auth:account-locked": { email: string; ip?: string; attempts: number; lockoutMinutes: number };
  "auth:account-locked-check": { email: string; minutesLeft: number };

  // Course events
  "course:created": { userId: string; courseId: string; title: string };
  "course:updated": { userId: string; courseId: string; title: string };
  "course:deleted": { userId: string; courseId: string };
}

type EventHandler<T> = (payload: T) => void | Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler<unknown>[]>();

  on<K extends keyof DomainEventMap>(
    event: K,
    handler: EventHandler<DomainEventMap[K]>,
  ): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(event, list);
  }

  off<K extends keyof DomainEventMap>(
    event: K,
    handler: EventHandler<DomainEventMap[K]>,
  ): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const idx = list.indexOf(handler as EventHandler<unknown>);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit<K extends keyof DomainEventMap>(
    event: K,
    payload: DomainEventMap[K],
  ): void {
    const list = this.handlers.get(event);
    if (!list) return;

    for (const handler of list) {
      try {
        const result = handler(payload);
        // If handler returns a promise, catch async errors too
        if (result && typeof result === "object" && "catch" in result) {
          (result as Promise<void>).catch((err) => {
            logger.error({ err, event }, "Async event handler failed");
          });
        }
      } catch (err) {
        logger.error({ err, event }, "Event handler failed");
      }
    }
  }

  /** Remove all handlers. Useful for test teardown. */
  clearAll(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
