import { apiLeaveRepository } from './leave-api-repository';
import { mockLeaveRepository } from './mock-leave-repository';
import type { LeaveRepository } from './leave-types';
import { LEAVE_POLICIES, LEAVE_TYPES } from './leave-config-data';
import { LeavePoliciesScreen } from './leave-policies-screen';
import { LeaveTypesScreen } from './leave-types-screen';

/**
 * Chooses the leave data source.
 *
 * Defaults to the mock. Flip `HRIS_LEAVE_DATA_SOURCE=api` to use the real
 * endpoint once it exists on the API.
 */
export { LeaveRequestsScreen } from './leave-requests-screen';
export { LeaveTypesScreen, LeavePoliciesScreen };
export function getLeaveRepository(): LeaveRepository {
  const configured = process.env['HRIS_LEAVE_DATA_SOURCE'] ?? 'mock';
  if (configured === 'api') return apiLeaveRepository;
  return mockLeaveRepository;
}

/** Leave type definitions for the configuration screen. */
export function getLeaveTypes(): readonly LeaveTypeLike[] {
  return LEAVE_TYPES;
}

/** Leave entitlement policies for the configuration screen. */
export function getLeavePolicies(): readonly LeavePolicyLike[] {
  return LEAVE_POLICIES;
}

type LeaveTypeLike = (typeof LEAVE_TYPES)[number];
type LeavePolicyLike = (typeof LEAVE_POLICIES)[number];

export type {
  LeaveRequest,
  LeaveRequestPage,
  LeaveRequestQuery,
  LeaveRepository,
  CreateLeaveRequestInput,
} from './leave-types';
