/**
 * Employee lifecycle and employment classification contracts.
 *
 * The lifecycle is modelled as an explicit state machine so that illegal
 * transitions are rejected in one shared place instead of being re-implemented
 * per consumer (MASTER_PRD section 7).
 */

export const EMPLOYEE_LIFECYCLE_STAGES = [
  'RECRUITMENT',
  'PRE_EMPLOYMENT',
  'ONBOARDING',
  'ACTIVE',
  'TRANSFER',
  'PROMOTION',
  'SUSPENSION',
  'RESIGNATION',
  'TERMINATION',
  'OFFBOARDING',
  'ALUMNI',
] as const;

export type EmployeeLifecycleStage = (typeof EMPLOYEE_LIFECYCLE_STAGES)[number];

/**
 * Legal forward transitions.
 *
 * `TRANSFER` and `PROMOTION` are modeled as transient stages because they are
 * organizational changes to an active employee rather than terminal states.
 * A change back to `ACTIVE` records the completion of the change while the
 * employment history retains the transition record.
 */
export const EMPLOYEE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<EmployeeLifecycleStage, readonly EmployeeLifecycleStage[]>
> = Object.freeze({
  RECRUITMENT: ['PRE_EMPLOYMENT', 'TERMINATION'],
  PRE_EMPLOYMENT: ['ONBOARDING', 'TERMINATION'],
  ONBOARDING: ['ACTIVE', 'RESIGNATION', 'TERMINATION'],
  ACTIVE: ['TRANSFER', 'PROMOTION', 'SUSPENSION', 'RESIGNATION', 'TERMINATION'],
  TRANSFER: ['ACTIVE', 'RESIGNATION', 'TERMINATION'],
  PROMOTION: ['ACTIVE', 'SUSPENSION', 'RESIGNATION', 'TERMINATION'],
  SUSPENSION: ['ACTIVE', 'RESIGNATION', 'TERMINATION'],
  RESIGNATION: ['OFFBOARDING'],
  TERMINATION: ['OFFBOARDING'],
  OFFBOARDING: ['ALUMNI'],
  ALUMNI: [],
});

export function isEmployeeLifecycleStage(value: unknown): value is EmployeeLifecycleStage {
  return (
    typeof value === 'string' && (EMPLOYEE_LIFECYCLE_STAGES as readonly string[]).includes(value)
  );
}

export function canTransitionEmployee(
  from: EmployeeLifecycleStage,
  to: EmployeeLifecycleStage,
): boolean {
  return EMPLOYEE_LIFECYCLE_TRANSITIONS[from].includes(to);
}

/** Stages after which no further employment is expected. */
export const TERMINAL_LIFECYCLE_STAGES: readonly EmployeeLifecycleStage[] = Object.freeze([
  'ALUMNI',
]);

/** Employment classification. Drives entitlement rules, not just reporting. */
export const EMPLOYMENT_TYPES = [
  'PERMANENT',
  'FIXED_TERM',
  'CONTRACT',
  'INTERN',
  'PART_TIME',
  'TEMPORARY',
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYEE_STATUSES = [
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'INACTIVE',
  'TERMINATED',
] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Countries are configuration, never hardcoded statutory logic. */
export const COUNTRY_CODES = ['MY', 'ID', 'SG', 'TH', 'VN'] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];
