import { DEFAULT_PAGE_SIZE } from '@hris/shared-types';
import { describe, expect, it } from 'vitest';

import type { Employee, EmployeePage, EmployeeQuery, EmployeeSort } from './employee-types';
import { EMPLOYEE_STATUSES, mockEmployeeRepository } from './mock-employee-repository';

/** Guards against a cursor cycle that never terminates. */
const MAX_PAGES = 50;

/**
 * Continues `query` with a cursor.
 *
 * The limit is re-stated explicitly rather than spread from `query.page`. Spreading an
 * optional `page` yields an optional `limit`, which does not satisfy `PageParams` — and
 * the type is right to complain, since a page request with no limit is ambiguous.
 */
const withCursor = (query: EmployeeQuery, cursor: string): EmployeeQuery => ({
  ...query,
  page: { limit: query.page?.limit ?? DEFAULT_PAGE_SIZE, cursor },
});

/**
 * The cursor of a page that must have one.
 *
 * A test that reads `page.pageInfo.endCursor!` would happily assert against `undefined`
 * and pass for the wrong reason if the page under test stopped reporting a next page.
 * Failing here names the actual problem.
 */
function requireCursor(page: EmployeePage): string {
  const cursor = page.pageInfo.endCursor;
  if (cursor === null) {
    throw new Error('expected this page to report a next page, but endCursor was null');
  }
  return cursor;
}

/**
 * Walks the directory the way the table does: follow `endCursor` until
 * `hasNextPage` is false, accumulating every row.
 *
 * Asserting on one page in isolation would pass even if the second page repeated the
 * first, so the traversal itself is the assertion.
 */
async function drain(query: EmployeeQuery): Promise<readonly Employee[]> {
  const collected: Employee[] = [];
  let page = await mockEmployeeRepository.list(query);
  let pages = 0;

  collected.push(...page.items);

  while (page.pageInfo.hasNextPage) {
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new Error(`pagination did not terminate within ${MAX_PAGES} pages`);
    }

    page = await mockEmployeeRepository.list(withCursor(query, requireCursor(page)));
    collected.push(...page.items);
  }

  return collected;
}

/** The page reached by following cursors until the walk ends, for end-state assertions. */
async function drainToFinalPage(query: EmployeeQuery) {
  let page = await mockEmployeeRepository.list(query);
  let pages = 0;

  while (page.pageInfo.hasNextPage) {
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new Error(`pagination did not terminate within ${MAX_PAGES} pages`);
    }
    page = await mockEmployeeRepository.list(withCursor(query, requireCursor(page)));
  }

  return page;
}

/** The first employee in the default order, used as a target for filter assertions. */
async function firstEmployee(): Promise<Employee> {
  const page = await mockEmployeeRepository.list({ page: { limit: 1 } });
  const employee = page.items[0];
  if (employee === undefined) {
    throw new Error('mock directory produced no employees');
  }
  return employee;
}

describe('mockEmployeeRepository', () => {
  it('returns a first page no larger than the limit and reports more available', async () => {
    const page = await mockEmployeeRepository.list({ page: { limit: 10 } });

    expect(page.items).toHaveLength(10);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.endCursor).not.toBeNull();
  });

  it('ends with hasNextPage false and no cursor', async () => {
    const final = await drainToFinalPage({ page: { limit: 10 } });

    expect(final.pageInfo.hasNextPage).toBe(false);
    expect(final.pageInfo.endCursor).toBeNull();
  });

  it('returns each employee exactly once across the whole walk', async () => {
    const all = await drain({ page: { limit: 7 } });
    const ids = all.map((employee) => employee.id);

    expect(all.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never leaks the surplus row into the page', async () => {
    const limit = 5;
    const first = await mockEmployeeRepository.list({ page: { limit } });
    const second = await mockEmployeeRepository.list({
      page: { limit, cursor: requireCursor(first) },
    });

    expect(first.items).toHaveLength(limit);
    expect(second.items).toHaveLength(limit);

    const overlap = first.items
      .map((employee) => employee.id)
      .filter((id) => second.items.some((employee) => employee.id === id));
    expect(overlap).toEqual([]);
  });

  it('is deterministic across calls', async () => {
    const first = await mockEmployeeRepository.list({ page: { limit: 20 } });
    const second = await mockEmployeeRepository.list({ page: { limit: 20 } });

    expect(second.items).toEqual(first.items);
  });

  it.each(['name', 'hireDate'] satisfies readonly EmployeeSort[])(
    'returns %s order with the id as a total tie-break',
    async (sort) => {
      const all = await drain({ page: { limit: 9 }, sort });
      const key = sort === 'name' ? 'fullName' : 'hireDate';
      const keys = all.map((employee) => `${employee[key]} ${employee.id}`);

      expect(keys.length).toBeGreaterThan(0);
      expect([...keys].sort()).toEqual(keys);
    },
  );

  it('produces a different sequence for each sort', async () => {
    const byName = await drain({ page: { limit: 20 }, sort: 'name' });
    const byHireDate = await drain({ page: { limit: 20 }, sort: 'hireDate' });

    expect(byName.map((employee) => employee.id)).not.toEqual(
      byHireDate.map((employee) => employee.id),
    );
  });

  it('filters by status', async () => {
    const all = await drain({ page: { limit: 20 }, status: 'ON_LEAVE' });

    expect(all.length).toBeGreaterThan(0);
    expect(all.every((employee) => employee.status === 'ON_LEAVE')).toBe(true);
  });

  it('treats an explicit ALL status as no filter', async () => {
    const unfiltered = await drain({ page: { limit: 20 } });
    const explicitAll = await drain({ page: { limit: 20 }, status: 'ALL' });

    expect(explicitAll.map((employee) => employee.id)).toEqual(
      unfiltered.map((employee) => employee.id),
    );
  });

  it('matches free text against the email', async () => {
    const target = await firstEmployee();
    const needle = target.email.toLowerCase();
    const matched = await drain({ page: { limit: 20 }, search: needle });

    expect(matched.map((employee) => employee.id)).toContain(target.id);
    expect(matched.every((employee) => employee.email.toLowerCase().includes(needle))).toBe(true);
  });

  it('matches free text against the employee number', async () => {
    const target = await firstEmployee();
    const matched = await drain({ page: { limit: 20 }, search: target.employeeNumber });

    expect(matched.map((employee) => employee.id)).toEqual([target.id]);
  });

  it('returns an empty page rather than throwing when nothing matches', async () => {
    const page = await mockEmployeeRepository.list({ page: { limit: 20 }, search: 'zzzznomatch' });

    expect(page.items).toEqual([]);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(page.pageInfo.endCursor).toBeNull();
  });

  it('ignores surrounding whitespace in the search term', async () => {
    const padded = await drain({ page: { limit: 20 }, search: '  ' });
    const absent = await drain({ page: { limit: 20 } });

    expect(padded.map((employee) => employee.id)).toEqual(absent.map((employee) => employee.id));
  });

  it('rejects a cursor replayed under different filters', async () => {
    const first = await mockEmployeeRepository.list({ page: { limit: 5 }, search: 'a' });

    await expect(
      mockEmployeeRepository.list({
        page: { limit: 5, cursor: requireCursor(first) },
        search: 'b',
      }),
    ).rejects.toThrow(/cursor/i);
  });

  it('rejects a cursor issued for a different sort', async () => {
    const first = await mockEmployeeRepository.list({ page: { limit: 5 }, sort: 'name' });

    await expect(
      mockEmployeeRepository.list({
        page: { limit: 5, cursor: requireCursor(first) },
        sort: 'hireDate',
      }),
    ).rejects.toThrow(/cursor/i);
  });

  it('rejects a corrupt cursor', async () => {
    await expect(
      mockEmployeeRepository.list({ page: { limit: 5, cursor: 'not-a-cursor' } }),
    ).rejects.toThrow(/cursor/i);
  });

  it('clamps a limit above the maximum', async () => {
    const page = await mockEmployeeRepository.list({ page: { limit: 100_000 } });

    expect(page.items.length).toBeLessThanOrEqual(100);
  });

  it('works with no page params at all', async () => {
    const page = await mockEmployeeRepository.list({});

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.pageInfo.hasNextPage).toBe(true);
  });

  it('gives every employee the fields the table renders', async () => {
    const all = await drain({ page: { limit: 100 } });

    expect(all.length).toBeGreaterThan(0);
    for (const employee of all) {
      expect(employee.fullName).not.toBe('');
      expect(employee.email).toContain('@');
      expect(employee.department).not.toBe('');
      expect(employee.jobTitle).not.toBe('');
      expect(employee.employmentType).not.toBe('');
      expect(employee.hireDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(EMPLOYEE_STATUSES as readonly string[]).toContain(employee.status);
    }
  });

  it('offers only distinct status values', () => {
    expect(new Set(EMPLOYEE_STATUSES).size).toBe(EMPLOYEE_STATUSES.length);
  });

  it('resolves a known id to its full record', async () => {
    const target = await firstEmployee();
    const employee = await mockEmployeeRepository.getById(target.id);

    expect(employee).not.toBeNull();
    expect(employee?.id).toBe(target.id);
    expect(employee?.fullName).toBe(target.fullName);
  });

  it('returns null for an id that is not present', async () => {
    await expect(mockEmployeeRepository.getById('missing-employee-id')).resolves.toBeNull();
  });
});
