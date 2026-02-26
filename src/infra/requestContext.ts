import { AsyncLocalStorage } from "async_hooks";
import type { Logger } from "@/utils/logger";

export interface QueryStats {
  count: number;
  totalMs: number;
}

export interface RequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
  logger?: Logger;
  queryStats: QueryStats;
  // Enriched after auth
  userId?: string;
  email?: string;
  role?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(
  initial: Omit<RequestContext, "queryStats">,
  fn: () => T,
): T {
  const ctx: RequestContext = { ...initial, queryStats: { count: 0, totalMs: 0 } };
  return als.run(ctx, fn);
}

export function getContext(): RequestContext {
  const ctx = als.getStore();
  if (!ctx) {
    throw new Error("No request context available — called outside of request scope");
  }
  return ctx;
}

export function tryGetContext(): RequestContext | undefined {
  return als.getStore();
}

export function enrichContext(
  data: Partial<Pick<RequestContext, "userId" | "email" | "role">>,
): void {
  const ctx = als.getStore();
  if (ctx) {
    Object.assign(ctx, data);
  }
}
