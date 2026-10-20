import type { Employee } from '@/features/employees/employee-types';

/**
 * Headcount breakdown derivations for the headcount report.
 *
 * Each function is a pure derivation over the employee rows the page already holds,
 * following the same pattern as `computeDirectoryFacts`: one pass, no side effects,
 * and every number traceable to the rows that produced it.
 */

export interface GroupCount {
  readonly key: string;
  readonly count: number;
  /** Share of the total headcount, 0–1. */
  readonly share: number;
}

export interface HeadcountFacts {
  readonly total: number;
  readonly active: number;
  readonly onLeave: number;
  readonly departments: number;
  readonly byDepartment: readonly GroupCount[];
  readonly byEmploymentType: readonly GroupCount[];
  readonly byStatus: readonly GroupCount[];
}

/**
 * Groups rows by a key function and counts each group, sorted by count descending.
 * The share is the group's fraction of all rows, so the shares sum to 1.
 */
function groupBy(
  rows: readonly Employee[],
  keyFn: (row: Employee) => string,
): readonly GroupCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = rows.length;
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      count,
      share: total === 0 ? 0 : count / total,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function computeHeadcountFacts(items: readonly Employee[]): HeadcountFacts {
  const departments = new Set<string>();
  let active = 0;
  let onLeave = 0;

  for (const employee of items) {
    departments.add(employee.department);
    if (employee.status === 'ACTIVE') active += 1;
    if (employee.status === 'ON_LEAVE') onLeave += 1;
  }

  return {
    total: items.length,
    active,
    onLeave,
    departments: departments.size,
    byDepartment: groupBy(items, (row) => row.department),
    byEmploymentType: groupBy(items, (row) => row.employmentType),
    byStatus: groupBy(items, (row) => row.status),
  };
}
