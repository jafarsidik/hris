/**
 * Employee lifecycle and employment classification contracts.
 *
 * The lifecycle is modelled as an explicit state machine so that illegal
 * transitions are rejected in one shared place instead of being re-implemented
 * per consumer (MASTER_PRD section 7).
 */

import type { PageParams } from '../common/pagination';

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

/**
 * One employment record as the UI consumes it.
 *
 * Flat and already shaped: the department is a label, not an id, and dates are
 * strings. Shaping happens once at the repository boundary.
 */
export interface EmployeeSummary {
  readonly id: string;
  readonly employeeNumber: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly department: string | null;
  readonly employmentType: string;
  /** ISO 8601 date. Formatted for display at the point of rendering. */
  readonly hireDate: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One position in the position master. */
export interface PositionSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly organizationalUnitId: string | null;
  readonly organizationalUnitName: string | null;
  readonly jobGrade: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields used to create or update an employee. */
export interface CreateEmployeeInput {
  readonly userId: string;
  readonly employeeNumber: string;
  readonly organizationalUnitId: string | null;
  readonly positionId: string | null;
  readonly employmentType: string;
  readonly status: string;
  readonly hireDate: string;
}

/** Fields used to update an employee. All optional. */
export interface UpdateEmployeeInput {
  readonly employeeNumber?: string;
  readonly organizationalUnitId?: string | null;
  readonly positionId?: string | null;
  readonly employmentType?: string;
  readonly status?: string;
  readonly hireDate?: string;
  readonly terminationDate?: string | null;
}

/** Fields used to create or update a position. */
export interface CreatePositionInput {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly organizationalUnitId: string | null;
  readonly jobGrade: string | null;
  readonly isActive?: boolean;
}

/** Fields used to update a position. All optional. */
export interface UpdatePositionInput {
  readonly code?: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly organizationalUnitId?: string | null;
  readonly jobGrade?: string | null;
  readonly isActive?: boolean;
}

/** Employee list query. Follows the cursor pagination contract. */
export interface EmployeeQuery {
  readonly search?: string;
  readonly status?: string;
  readonly department?: string;
  readonly employmentType?: string;
  readonly sort?: 'name' | 'hireDate';
  readonly page?: PageParams;
}

/** Position list query. Follows the cursor pagination contract. */
export interface PositionQuery {
  readonly search?: string;
  readonly unitId?: string;
  readonly isActive?: boolean;
  readonly page?: PageParams;
}

/** One leave type definition. */
export interface LeaveTypeSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isPaid: boolean;
  readonly defaultDays: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One leave entitlement policy. */
export interface LeavePolicySummary {
  readonly id: string;
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly annualDays: number;
  readonly carryForward: boolean;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One leave request. */
export interface LeaveRequestSummary {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly days: number;
  readonly reason: string | null;
  readonly status: string;
  readonly approverId: string | null;
  readonly approvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields used to create a leave type. */
export interface CreateLeaveTypeInput {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isPaid?: boolean;
  readonly defaultDays?: number;
  readonly isActive?: boolean;
}

/** Fields used to update a leave type. All optional. */
export interface UpdateLeaveTypeInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly isPaid?: boolean;
  readonly defaultDays?: number;
  readonly isActive?: boolean;
}

/** Fields used to create a leave policy. */
export interface CreateLeavePolicyInput {
  readonly leaveTypeId: string;
  readonly annualDays: number;
  readonly carryForward?: boolean;
  readonly isActive?: boolean;
}

/** Fields used to update a leave policy. All optional. */
export interface UpdateLeavePolicyInput {
  readonly annualDays?: number;
  readonly carryForward?: boolean;
  readonly isActive?: boolean;
}

/** Fields used to create a leave request. */
export interface CreateLeaveRequestInput {
  readonly employeeId: string;
  readonly leaveTypeId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string | null;
}

/** Fields used to update a leave request. All optional. */
export interface UpdateLeaveRequestInput {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly days?: number;
  readonly reason?: string | null;
  readonly status?: string;
}

/** Leave type list query. */
export interface LeaveTypeQuery {
  readonly search?: string;
  readonly isActive?: boolean;
  readonly page?: PageParams;
}

/** Leave policy list query. */
export interface LeavePolicyQuery {
  readonly leaveTypeId?: string;
  readonly isActive?: boolean;
  readonly page?: PageParams;
}

/** Leave request list query. */
export interface LeaveRequestQuery {
  readonly employeeId?: string;
  readonly leaveTypeId?: string;
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}
