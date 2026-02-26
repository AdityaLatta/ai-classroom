import { LRUCache } from "lru-cache";

interface CacheOptions {
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Custom cache key function. Receives method arguments, returns string. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  key?: (...args: any[]) => string;
}

interface CacheEntry {
  value: unknown;
}

const cache = new LRUCache<string, CacheEntry>({
  max: 1000,
  ttl: 60_000, // default TTL, overridden per-entry
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAsyncMethod = (...args: any[]) => Promise<any>;

const isTest = process.env.NODE_ENV === "test";

/**
 * Class method decorator: @Cache({ ttl: 30000 })
 * Caches the return value based on a key derived from arguments.
 * Disabled in test environment to avoid interference between test cases.
 */
export function Cache(opts: CacheOptions) {
  return function <T extends AnyAsyncMethod>(
    target: T,
    context: ClassMethodDecoratorContext,
  ): T {
    if (isTest) return target;

    const methodName = String(context.name);

    const wrapper = async function (this: unknown, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
      const cacheKey = opts.key
        ? `${methodName}:${opts.key(...args)}`
        : `${methodName}:${JSON.stringify(args)}`;

      const cached = cache.get(cacheKey);
      if (cached !== undefined) {
        return cached.value as Awaited<ReturnType<T>>;
      }

      const result = await target.call(this, ...args);
      cache.set(cacheKey, { value: result }, { ttl: opts.ttl });
      return result;
    } as unknown as T;

    return wrapper;
  };
}

/**
 * Invalidate all cache entries whose key starts with the given prefix.
 */
export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Return cache statistics.
 */
export function getCacheStats(): { size: number; max: number } {
  return {
    size: cache.size,
    max: 1000,
  };
}
