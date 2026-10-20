import type { Employee } from '@/features/employees/employee-types';

/**
 * Workforce summary derivations for the workforce report.
 *
 * Combines headcount, distribution, joiners and tenure into one pass over the
 * employee rows, so the screen reads a single consistent snapshot.
 */

const DAY = 86_400_000;

const atUtcStart = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** `YYYY-MM-DD` hire date as a UTC timestamp, 0 for a malformed value. */
const hireTimestamp = (hireDate: string): number => {
  const parsed = new Date(`${hireDate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export interface GroupCount {
  readonly key: string;
  readonly count: number;
  /** Share of the total headcount, 0–1. */
  readonly share: number;
}

export interface TenureBucket {
  readonly label: string;
  readonly count: number;
  readonly share: number;
}

export interface WorkforceFacts {
  readonly total: number;
  readonly active: number;
  readonly onLeave: number;
  readonly departments: number;
  readonly joinersLast30Days: number;
  readonly joinersLast90Days: number;
  readonly byDepartment: readonly GroupCount[];
  readonly byEmploymentType: readonly GroupCount[];
  readonly byTenure: readonly TenureBucket[];
  readonly byStatus: readonly GroupCount[];
}

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

/** Tenure buckets in years, computed from hire date to today. */
const TENURE_BUCKETS = [
  { label: 'Under 1 year', minYears: 0, maxYears: 1 },
  { label: '1–3 years', minYears: 1, maxYears: 3 },
  { label: '3–5 years', minYears: 3, maxYears: 5 },
  { label: '5+ years', minYears: 5, maxYears: Infinity },
] as const;

export function computeWorkforceFacts(items: readonly Employee[]): WorkforceFacts {
  const today = atUtcStart(new Date());
  const departments = new Set<string>();
  let active = 0;
  let onLeave = 0;
  let joiners30 = 0;
  let joiners90 = 0;

  const tenureCounts = new Map<string, number>();
  for (const bucket of TENURE_BUCKETS) {
    tenureCounts.set(bucket.label, 0);
  }

  for (const employee of items) {
    departments.add(employee.department);
    if (employee.status === 'ACTIVE') active += 1;
    if (employee.status === 'ON_LEAVE') onLeave += 1;

    const hired = hireTimestamp(employee.hireDate);
    if (hired !== 0) {
      if (hired >= today - 30 * DAY) joiners30 += 1;
      if (hired >= today - 90 * DAY) joiners90 += 1;

      const yearsEmployed = (today - hired) / (365.25 * DAY);
      for (const bucket of TENURE_BUCKETS) {
        if (yearsEmployed >= bucket.minYears && yearsEmployed < bucket.maxYears) {
          tenureCounts.set(bucket.label, (tenureCounts.get(bucket.label) ?? 0) + 1);
          break;
        }
      }
    }
  }

  const total = items.length;
  const byTenure: readonly TenureBucket[] = TENURE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: tenureCounts.get(bucket.label) ?? 0,
    share: total === 0 ? 0 : (tenureCounts.get(bucket.label) ?? 0) / total,
  }));

  return {
    total: items.length,
    active,
    onLeave,
    departments: departments.size,
    joinersLast30Days: joiners30,
    joinersLast90Days: joiners90,
    byDepartment: groupBy(items, (row) => row.department),
    byEmploymentType: groupBy(items, (row) => row.employmentType),
    byTenure,
    byStatus: groupBy(items, (row) => row.status),
  };
}
