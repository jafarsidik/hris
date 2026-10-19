import type { PageParams, Paginated } from '@hris/shared-types';

export interface LeaveType {
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

export interface LeavePolicy {
  readonly id: string;
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly annualDays: number;
  readonly carryForward: boolean;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LeaveRequest {
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

export interface CreateLeaveRequestInput {
  readonly employeeId: string;
  readonly leaveTypeId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string | null;
}

export interface LeaveRequestQuery {
  readonly employeeId?: string;
  readonly leaveTypeId?: string;
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}

export type LeaveRequestPage = Paginated<LeaveRequest>;

export interface LeaveRepository {
  listRequests(query: LeaveRequestQuery): Promise<LeaveRequestPage>;
  getRequest(id: string): Promise<LeaveRequest | null>;
  createRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest>;
  updateRequest(
    id: string,
    input: Partial<CreateLeaveRequestInput> & { readonly status?: string },
  ): Promise<LeaveRequest>;
  deleteRequest(id: string): Promise<void>;
}
