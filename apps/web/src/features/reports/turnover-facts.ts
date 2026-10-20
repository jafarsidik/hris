import type { Employee } from '@/features/employees/employee-types';

/**
 * Turnover report derivations.
 *
 * Exit rule: an employee has exited when their status is TERMINATED or
 * INACTIVE. These are the two terminal, non-active states in the employee
 * lifecycle. ON_LEAVE, PROBATION and SUSPENDED are not exits — the employee
 * is still employed. The rule is applied consistently across every figure in
 * this report.
 *
 * The offboarding mock repository provides exit-reason data for cases that
 * have been through the offboarding workflow. Not every exit has an
 * offboarding case, so the reason breakdown covers only those that do.
 */

export interface TurnoverFacts {
  readonly totalHeadcount: number;
  readonly activeHeadcount: number;
  readonly exits: number;
  /** Exits as a share of total headcount, 0–1. */
  readonly attritionRate: number;
  readonly byDepartment: readonly DepartmentExitCount[];
  readonly byReason: readonly ReasonCount[];
}

export interface DepartmentExitCount {
  readonly key: string;
  readonly total: number;
  readonly exits: number;
  /** Exits as a share of the department's headcount, 0–1. */
  readonly rate: number;
}

export interface ReasonCount {
  readonly key: string;
  readonly count: number;
}

const EXIT_STATUSES = new Set(['TERMINATED', 'INACTIVE']);

export function computeTurnoverFacts(
  employees: readonly Employee[],
  exitReasons: readonly { reason: string }[],
): TurnoverFacts {
  const departmentMap = new Map<string, { total: number; exits: number }>();
  let totalHeadcount = 0;
  let activeHeadcount = 0;
  let exits = 0;

  for (const employee of employees) {
    totalHeadcount += 1;
    const dept = employee.department;
    const entry = departmentMap.get(dept) ?? { total: 0, exits: 0 };
    entry.total += 1;

    if (EXIT_STATUSES.has(employee.status)) {
      exits += 1;
      entry.exits += 1;
    } else {
      activeHeadcount += 1;
    }

    departmentMap.set(dept, entry);
  }

  const byDepartment: readonly DepartmentExitCount[] = [...departmentMap.entries()]
    .map(([key, { total, exits: deptExits }]) => ({
      key,
      total,
      exits: deptExits,
      rate: total === 0 ? 0 : deptExits / total,
    }))
    .sort((a, b) => b.rate - a.rate || a.key.localeCompare(b.key));

  const reasonCounts = new Map<string, number>();
  for (const { reason } of exitReasons) {
    const key = reason;
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }

  const byReason: readonly ReasonCount[] = [...reasonCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  return {
    totalHeadcount,
    activeHeadcount,
    exits,
    attritionRate: totalHeadcount === 0 ? 0 : exits / totalHeadcount,
    byDepartment,
    byReason,
  };
}
