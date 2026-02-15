// src/utils/pagination.ts

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
