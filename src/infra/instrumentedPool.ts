import { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from "pg";
import { logger } from "@/utils/logger";
import { tryGetContext, QueryStats } from "./requestContext";

const SLOW_QUERY_THRESHOLD_MS = 500;

/**
 * Monkey-patches pool.query to add timing, slow-query logging,
 * and per-request query stats via ALS context.
 */
export function instrumentPool(pool: Pool): void {
  const originalQuery = pool.query.bind(pool);

  // pg's pool.query has multiple overloads — use a single generic wrapper
  pool.query = async function instrumentedQuery(
    ...args: unknown[]
  ): Promise<QueryResult<QueryResultRow>> {
    return instrumentedQueryCall(originalQuery, args);
  } as Pool["query"];
}

/**
 * Patches a PoolClient's query method with timing and stats.
 * Call this after pool.connect() to capture transaction queries.
 */
export function instrumentClient(client: PoolClient): void {
  const originalQuery = client.query.bind(client);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).query = async function instrumentedClientQuery(
    ...args: unknown[]
  ): Promise<QueryResult<QueryResultRow>> {
    return instrumentedQueryCall(originalQuery, args);
  };
}

async function instrumentedQueryCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalQuery: (...a: any[]) => Promise<QueryResult>,
  args: unknown[],
): Promise<QueryResult<QueryResultRow>> {
  const start = performance.now();

  try {
    const result = await originalQuery(...args);

    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    recordStats(durationMs);

    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      const queryText = typeof args[0] === "string"
        ? args[0]
        : (args[0] as QueryConfig)?.text ?? "unknown";
      logger.warn(
        { durationMs, query: queryText.slice(0, 200) },
        "Slow query detected",
      );
    }

    return result;
  } catch (error) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    recordStats(durationMs);
    throw error;
  }
}

function recordStats(durationMs: number): void {
  const ctx = tryGetContext();
  if (ctx) {
    ctx.queryStats.count++;
    ctx.queryStats.totalMs += durationMs;
  }
}

export function getQueryStats(): QueryStats | undefined {
  return tryGetContext()?.queryStats;
}
