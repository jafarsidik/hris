import type { Employee } from './employee-types';

/**
 * Facts about the directory that the dashboard, the notification bell and the
 * attention panel all need.
 *
 * A single derivation keeps the surfaces from disagreeing: the bell says "3 on leave"
 * and the dashboard KPI says 3, because both read the same function over the same rows.
 * The input is a full render of the repository, which is how the other surfaces already
 * work; a real endpoint would replace this with server-aggregated counts.
 */

const DAY = 86_400_000;

const atUtcStart = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** `YYYY-MM-DD` hire date as a UTC timestamp, 0 for a malformed value. */
const hireTimestamp = (hireDate: string): number => {
  const parsed = new Date(`${hireDate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

/** The probation window a generated record implies, in milliseconds. */
const PROBATION_PERIOD = 180 * DAY;

export interface DirectoryFacts {
  readonly total: number;
  readonly active: number;
  readonly onLeave: number;
  readonly probation: number;
  /** Probation ending within the next 30 days, assuming a six-month period. */
  readonly confirmingSoon: number;
  readonly recentJoiners: number;
  readonly departments: number;
}

export function computeDirectoryFacts(items: readonly Employee[]): DirectoryFacts {
  const today = atUtcStart(new Date());
  const departments = new Set<string>();

  let active = 0;
  let onLeave = 0;
  let probation = 0;
  let confirmingSoon = 0;
  let recentJoiners = 0;

  for (const employee of items) {
    departments.add(employee.department);

    if (employee.status === 'ACTIVE') active += 1;
    if (employee.status === 'ON_LEAVE') onLeave += 1;

    if (employee.status === 'PROBATION') {
      probation += 1;
      const hired = hireTimestamp(employee.hireDate);
      if (hired !== 0) {
        const confirmation = hired + PROBATION_PERIOD;
        if (confirmation >= today && confirmation <= today + 30 * DAY) confirmingSoon += 1;
      }
    }

    const hired = hireTimestamp(employee.hireDate);
    if (hired !== 0 && hired >= today - 30 * DAY) recentJoiners += 1;
  }

  return {
    total: items.length,
    active,
    onLeave,
    probation,
    confirmingSoon,
    recentJoiners,
    departments: departments.size,
  };
}
