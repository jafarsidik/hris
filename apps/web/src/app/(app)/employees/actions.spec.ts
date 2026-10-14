import { DEFAULT_PAGE_SIZE } from '@hris/shared-types';
import { describe, expect, it } from 'vitest';

import { loadMoreEmployees } from './actions';

/**
 * The action is the whole of the "load more" logic; the button only calls it. Exercising
 * it here covers the paging that a browser test would otherwise be needed for, without
 * introducing a browser dependency.
 */

describe('loadMoreEmployees', () => {
  it('returns the first page when no cursor is given', async () => {
    const result = await loadMoreEmployees({ cursor: undefined, limit: 5 });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.page.items).toHaveLength(5);
    expect(result.page.pageInfo.hasNextPage).toBe(true);
  });

  it('continues from a cursor into distinct rows', async () => {
    const first = await loadMoreEmployees({ cursor: undefined, limit: 5 });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const cursor = first.page.pageInfo.endCursor;
    expect(cursor).not.toBeNull();

    const second = await loadMoreEmployees({ cursor, limit: 5 });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    const firstIds = new Set(first.page.items.map((employee) => employee.id));
    const repeats = second.page.items.filter((employee) => firstIds.has(employee.id));

    expect(second.page.items).toHaveLength(5);
    expect(repeats).toEqual([]);
  });

  it('walks the directory to its end without repeating a row', async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    let guard = 0;

    for (;;) {
      const result = await loadMoreEmployees({ cursor, limit: 7 });
      guard += 1;
      if (guard > 50) {
        throw new Error('pagination did not terminate');
      }
      if (!result.ok) {
        throw new Error('walk was rejected');
      }

      ids.push(...result.page.items.map((employee) => employee.id));

      if (!result.page.pageInfo.hasNextPage) {
        break;
      }
      cursor = result.page.pageInfo.endCursor ?? undefined;
    }

    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports an invalid cursor instead of throwing', async () => {
    const result = await loadMoreEmployees({ cursor: 'not-a-cursor', limit: 5 });

    expect(result).toEqual({ ok: false, reason: 'INVALID_CURSOR' });
  });

  it('reports an invalid cursor rather than returning an empty page', async () => {
    const first = await loadMoreEmployees({ cursor: undefined, limit: 5 });
    if (!first.ok) {
      throw new Error('expected the first page to succeed');
    }

    const result = await loadMoreEmployees({
      cursor: first.page.pageInfo.endCursor,
      limit: 5,
      search: 'a-different-search',
    });

    // Returning an empty page here would read as "nothing matches this filter", which is
    // a different and wrong conclusion.
    expect(result.ok).toBe(false);
  });

  it.each([
    ['a non-string cursor', 42],
    ['an empty cursor', ''],
    ['an object cursor', { value: 'x' }],
  ])('treats %s as no cursor', async (_label, cursor) => {
    const result = await loadMoreEmployees({ cursor, limit: 3 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page.items).toHaveLength(3);
      expect(result.page.pageInfo.hasNextPage).toBe(true);
    }
  });

  it.each([
    ['zero', 0],
    ['a negative limit', -10],
    ['a fractional limit', 2.5],
    ['a non-numeric limit', 'ten'],
    ['a limit above the maximum', 100_000],
    ['no limit at all', undefined],
  ])('falls back to a safe limit given %s', async (_label, limit) => {
    const result = await loadMoreEmployees({ cursor: undefined, limit });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page.items.length).toBeGreaterThan(0);
      expect(result.page.items.length).toBeLessThanOrEqual(100);
    }
  });

  it('defaults to the shared default page size', async () => {
    const result = await loadMoreEmployees({ cursor: undefined, limit: undefined });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page.items.length).toBeLessThanOrEqual(DEFAULT_PAGE_SIZE);
    }
  });

  it.each([
    ['an unknown sort', 'salary'],
    ['a non-string sort', 7],
    ['no sort', undefined],
  ])('falls back to sorting by name given %s', async (_label, sort) => {
    const byFallback = await loadMoreEmployees({ cursor: undefined, limit: 5, sort });
    const byName = await loadMoreEmployees({ cursor: undefined, limit: 5, sort: 'name' });

    expect(byFallback.ok && byName.ok).toBe(true);
    if (byFallback.ok && byName.ok) {
      expect(byFallback.page.items.map((employee) => employee.id)).toEqual(
        byName.page.items.map((employee) => employee.id),
      );
    }
  });

  it('honours a valid sort', async () => {
    const byName = await loadMoreEmployees({ cursor: undefined, limit: 10, sort: 'name' });
    const byHireDate = await loadMoreEmployees({ cursor: undefined, limit: 10, sort: 'hireDate' });

    expect(byName.ok && byHireDate.ok).toBe(true);
    if (byName.ok && byHireDate.ok) {
      expect(byName.page.items.map((employee) => employee.id)).not.toEqual(
        byHireDate.page.items.map((employee) => employee.id),
      );
    }
  });

  it.each([
    ['a numeric status', 5],
    ['a non-string search', { term: 'x' }],
  ])('ignores %s rather than failing', async (_label, value) => {
    const result = await loadMoreEmployees({
      cursor: undefined,
      limit: 5,
      ...(typeof value === 'number' ? { status: value } : { search: value }),
    });

    expect(result.ok).toBe(true);
  });

  it('applies a status filter to paged-in rows too', async () => {
    const first = await loadMoreEmployees({ cursor: undefined, limit: 3, status: 'ACTIVE' });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const cursor = first.page.pageInfo.endCursor;
    const second = await loadMoreEmployees({
      cursor,
      limit: 3,
      status: 'ACTIVE',
    });

    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    const all = [...first.page.items, ...second.page.items];
    expect(all.every((employee) => employee.status === 'ACTIVE')).toBe(true);
  });
});
