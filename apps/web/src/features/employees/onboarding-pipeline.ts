import type { Employee } from './employee-types';

const DAY = 86_400_000;

const atUtcStart = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const hireTimestamp = (hireDate: string): number => {
  const parsed = new Date(`${hireDate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const PROBATION_PERIOD = 180 * DAY;

export type ConfirmationStatus = 'due-soon' | 'upcoming' | 'not-applicable';

export interface OnboardingRow {
  readonly id: string;
  readonly employee: Employee;
  readonly daysSinceStart: number;
  readonly probationEnd: string;
  readonly confirmationStatus: ConfirmationStatus;
}

export interface OnboardingPipeline {
  readonly rows: readonly OnboardingRow[];
  readonly totalCount: number;
  readonly startingThisMonth: number;
  readonly confirmationsDue30Days: number;
}

/**
 * Derives the onboarding pipeline from live employee data.
 *
 * The pipeline includes people in PROBATION plus recent joiners (hireDate within
 * the last 90 days). The probation window is six months, the same rule
 * `directory-facts.ts` encodes. Confirmation status is derived from the probation
 * end date: due soon (within 30 days), upcoming (beyond 30 days), or not applicable
 * (not in probation).
 */
export function computeOnboardingPipeline(
  items: readonly Employee[],
  today = new Date(),
): OnboardingPipeline {
  const todayUtc = atUtcStart(today);
  const ninetyDaysAgo = todayUtc - 90 * DAY;
  const thirtyDaysFromNow = todayUtc + 30 * DAY;

  const rows: OnboardingRow[] = [];
  let startingThisMonth = 0;
  let confirmationsDue30Days = 0;

  for (const employee of items) {
    const hired = hireTimestamp(employee.hireDate);
    if (hired === 0) continue;

    const isProbation = employee.status === 'PROBATION';
    const isRecentJoiner = hired >= ninetyDaysAgo && hired <= todayUtc;

    if (!isProbation && !isRecentJoiner) continue;

    const daysSinceStart = Math.floor((todayUtc - hired) / DAY);
    const probationEndTimestamp = hired + PROBATION_PERIOD;
    const probationEnd = new Date(probationEndTimestamp).toISOString().slice(0, 10);

    let confirmationStatus: ConfirmationStatus;
    if (!isProbation) {
      confirmationStatus = 'not-applicable';
    } else if (probationEndTimestamp <= thirtyDaysFromNow) {
      confirmationStatus = 'due-soon';
      confirmationsDue30Days += 1;
    } else {
      confirmationStatus = 'upcoming';
    }

    const hireDate = new Date(hired);
    if (
      hireDate.getUTCMonth() === today.getUTCMonth() &&
      hireDate.getUTCFullYear() === today.getUTCFullYear()
    ) {
      startingThisMonth += 1;
    }

    rows.push({
      id: employee.employeeNumber,
      employee,
      daysSinceStart,
      probationEnd,
      confirmationStatus,
    });
  }

  return {
    rows,
    totalCount: rows.length,
    startingThisMonth,
    confirmationsDue30Days,
  };
}
