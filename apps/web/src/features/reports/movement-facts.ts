import type { EmployeeMovementSummary } from '@hris/shared-types';

/**
 * Movement report derivations.
 *
 * Each function is a pure derivation over the movement rows the page already
 * holds, following the same pattern as `computeHeadcountFacts`: one pass, no
 * side effects, and every number traceable to the rows that produced it.
 */

/** A human-readable label for a `YYYY-MM` key. */

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** The UTC year-month key for an ISO date string, or null when malformed. */
function monthKey(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (match === null) return null;
  const year = match[1];
  const month = match[2];
  if (year === undefined || month === undefined) return null;
  return `${year}-${month}`;
}

/** A human-readable label for a `YYYY-MM` key. */
function monthLabel(key: string): string {
  const [year = '', month = ''] = key.split('-');
  const monthIndex = Number(month) - 1;
  const label = MONTH_LABELS[monthIndex] ?? month;
  return year === undefined ? label : `${label} ${year}`;
}

export interface MovementTypeCount {
  readonly key: string;
  readonly count: number;
}

export interface MovementMonthCount {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface MovementUnitCount {
  readonly key: string;
  readonly count: number;
}

export interface MovementFacts {
  readonly total: number;
  readonly thisYear: number;
  readonly thisMonth: number;
  readonly byType: readonly MovementTypeCount[];
  readonly byMonth: readonly MovementMonthCount[];
  readonly byDestinationUnit: readonly MovementUnitCount[];
}

export function computeMovementFacts(movements: readonly EmployeeMovementSummary[]): MovementFacts {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonthKey = `${currentYear}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const typeCounts = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  const unitCounts = new Map<string, number>();
  let thisYear = 0;
  let thisMonth = 0;

  for (const movement of movements) {
    const type = movement.movementType;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);

    const key = monthKey(movement.effectiveDate);
    if (key !== null) {
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
      const [year] = key.split('-');
      if (Number(year) === currentYear) thisYear += 1;
      if (key === currentMonthKey) thisMonth += 1;
    }

    const unit = movement.toUnitName ?? 'Unspecified';
    unitCounts.set(unit, (unitCounts.get(unit) ?? 0) + 1);
  }

  const byType: readonly MovementTypeCount[] = [...typeCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const byMonth: readonly MovementMonthCount[] = [...monthCounts.entries()]
    .map(([key, count]) => ({ key, label: monthLabel(key), count }))
    .sort((a, b) => b.key.localeCompare(a.key));

  const byDestinationUnit: readonly MovementUnitCount[] = [...unitCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  return {
    total: movements.length,
    thisYear,
    thisMonth,
    byType,
    byMonth,
    byDestinationUnit,
  };
}
