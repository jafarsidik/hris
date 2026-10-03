/**
 * Pagination contracts shared by every list endpoint.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  /** 1-based page number. */
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface Paginated<TItem> {
  readonly items: readonly TItem[];
  readonly meta: PaginatedMeta;
}

const toPositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
};

/**
 * Normalises untrusted pagination input into a bounded {@link PageParams}.
 *
 * This is the single place where `page`/`pageSize` query values are trusted;
 * every list endpoint must call it rather than reading the raw query object.
 */
export function normalisePageParams(input: {
  page?: unknown;
  pageSize?: unknown;
}): PageParams {
  const page = toPositiveInteger(input.page, DEFAULT_PAGE);
  const pageSize = Math.min(toPositiveInteger(input.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  return { page, pageSize };
}

export function buildPaginated<TItem>(items: readonly TItem[], params: PageParams, totalItems: number): Paginated<TItem> {
  const totalPages = totalItems <= 0 ? 0 : Math.ceil(totalItems / params.pageSize);
  return {
    items,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1 && totalPages > 0,
    },
  };
}

/** Offset/limit pair derived from {@link PageParams} for SQL queries. */
export function toOffsetLimit(params: PageParams): { skip: number; take: number } {
  return { skip: (params.page - 1) * params.pageSize, take: params.pageSize };
}