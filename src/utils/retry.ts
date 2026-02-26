import { logger } from "./logger";

interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  attempts?: number;
  /** Backoff strategy. Default: "exponential" */
  backoff?: "exponential" | "fixed";
  /** Base delay in ms between retries. Default: 1000 */
  delayMs?: number;
  /** Only retry if predicate returns true for the error. Default: always retry */
  retryIf?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  attempts: 3,
  backoff: "exponential",
  delayMs: 1000,
  retryIf: () => true,
};

function getDelay(attempt: number, opts: Required<RetryOptions>): number {
  if (opts.backoff === "fixed") return opts.delayMs;
  return opts.delayMs * Math.pow(2, attempt - 1);
}

/**
 * Standalone retry wrapper for non-class functions.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const resolved = { ...DEFAULT_OPTIONS, ...opts };
  resolved.attempts = Math.max(1, resolved.attempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= resolved.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === resolved.attempts || !resolved.retryIf(error)) {
        throw error;
      }

      const delay = getDelay(attempt, resolved);
      logger.warn(
        { attempt, maxAttempts: resolved.attempts, nextRetryMs: delay },
        "Retrying after transient failure",
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAsyncMethod = (...args: any[]) => Promise<any>;

/**
 * Class method decorator: @Retry({ attempts: 3 })
 * Uses TC39 Stage 3 decorator API (ClassMethodDecoratorContext).
 */
export function Retry(opts?: RetryOptions) {
  return function <T extends AnyAsyncMethod>(
    target: T,
    _context: ClassMethodDecoratorContext,
  ): T {
    const resolved = { ...DEFAULT_OPTIONS, ...opts };
    resolved.attempts = Math.max(1, resolved.attempts);

    const wrapper = async function (this: unknown, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
      let lastError: unknown;

      for (let attempt = 1; attempt <= resolved.attempts; attempt++) {
        try {
          return await target.call(this, ...args);
        } catch (error) {
          lastError = error;
          if (attempt === resolved.attempts || !resolved.retryIf(error)) {
            throw error;
          }

          const delay = getDelay(attempt, resolved);
          logger.warn(
            { attempt, maxAttempts: resolved.attempts, nextRetryMs: delay },
            "Retrying after transient failure",
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    } as unknown as T;

    return wrapper;
  };
}
