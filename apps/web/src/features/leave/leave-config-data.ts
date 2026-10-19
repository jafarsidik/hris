import type { LeavePolicy, LeaveType } from './leave-types';

/**
 * Deterministic leave configuration data used by the settings-style screens
 * until the live API is the default data source (`HRIS_LEAVE_DATA_SOURCE`).
 * The shapes mirror the API contract in `@hris/shared-types`
 * (`LeaveTypeSummary`, `LeavePolicySummary`).
 */
export const LEAVE_TYPES: readonly LeaveType[] = Object.freeze([
  {
    id: 'leave-type-0001',
    code: 'AL',
    name: 'Annual Leave',
    description: 'Yearly paid leave entitlement.',
    isPaid: true,
    defaultDays: 12,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'leave-type-0002',
    code: 'SL',
    name: 'Sick Leave',
    description: 'Paid sick leave with a medical note.',
    isPaid: true,
    defaultDays: 10,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'leave-type-0003',
    code: 'UL',
    name: 'Unpaid Leave',
    description: 'Extended unpaid leave of absence.',
    isPaid: false,
    defaultDays: 30,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'leave-type-0004',
    code: 'ML',
    name: 'Maternity Leave',
    description: 'Paid leave for childbirth and recovery.',
    isPaid: true,
    defaultDays: 90,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
] as const);

export const LEAVE_POLICIES: readonly LeavePolicy[] = Object.freeze([
  {
    id: 'leave-policy-0001',
    leaveTypeId: 'leave-type-0001',
    leaveTypeName: 'Annual Leave',
    annualDays: 12,
    carryForward: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'leave-policy-0002',
    leaveTypeId: 'leave-type-0002',
    leaveTypeName: 'Sick Leave',
    annualDays: 10,
    carryForward: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'leave-policy-0003',
    leaveTypeId: 'leave-type-0004',
    leaveTypeName: 'Maternity Leave',
    annualDays: 90,
    carryForward: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
] as const);
