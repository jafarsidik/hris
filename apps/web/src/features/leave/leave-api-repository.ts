import { serverApiRequestV1 } from '@/lib/api/server-config';

import type {
  LeaveRequest,
  LeaveRequestPage,
  LeaveRequestQuery,
  LeaveRepository,
  CreateLeaveRequestInput,
} from './leave-types';

/**
 * Reads and writes leave requests from the API.
 *
 * Not yet reachable: the leave endpoint does not exist on the API until the
 * leave module is wired up. Switching the data source to `api` would turn the
 * screens into 404s.
 */
class ApiLeaveRepository implements LeaveRepository {
  async listRequests(query: LeaveRequestQuery): Promise<LeaveRequestPage> {
    const params = new URLSearchParams();
    if (query.employeeId) params.set('employeeId', query.employeeId);
    if (query.leaveTypeId) params.set('leaveTypeId', query.leaveTypeId);
    if (query.status) params.set('status', query.status);
    if (query.search) params.set('search', query.search);
    if (query.page?.limit !== undefined) params.set('limit', String(query.page.limit));
    if (query.page?.cursor !== undefined) params.set('cursor', query.page.cursor);

    const data = await serverApiRequestV1<unknown>(`/leave/requests?${params.toString()}`, {
      headers: { 'cache-control': 'no-store' },
    });
    return parseLeaveRequestPage(data);
  }

  async getRequest(id: string): Promise<LeaveRequest | null> {
    const data = await serverApiRequestV1<unknown>(`/leave/requests/${encodeURIComponent(id)}`, {
      headers: { 'cache-control': 'no-store' },
    });
    return parseLeaveRequest(data);
  }

  async createRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    const data = await serverApiRequestV1<unknown>('/leave/requests', {
      method: 'POST',
      body: input,
    });
    return parseLeaveRequest(data);
  }

  async updateRequest(
    id: string,
    input: Partial<CreateLeaveRequestInput> & { readonly status?: string },
  ): Promise<LeaveRequest> {
    const data = await serverApiRequestV1<unknown>(`/leave/requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    });
    return parseLeaveRequest(data);
  }

  async deleteRequest(id: string): Promise<void> {
    await serverApiRequestV1<unknown>(`/leave/requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }
}

function parseLeaveRequest(data: unknown): LeaveRequest {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Leave request response was not an object');
  }
  return data as LeaveRequest;
}

function parseLeaveRequestPage(data: unknown): LeaveRequestPage {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Leave request page response was not an object');
  }
  const candidate = data as Partial<LeaveRequestPage>;
  if (!Array.isArray(candidate.items)) {
    throw new TypeError('Leave request page response had no items array');
  }
  if (typeof candidate.pageInfo !== 'object' || candidate.pageInfo === null) {
    throw new TypeError('Leave request page response had no pageInfo');
  }
  return {
    items: candidate.items as LeaveRequest[],
    pageInfo: candidate.pageInfo,
  };
}

export const apiLeaveRepository: LeaveRepository = new ApiLeaveRepository();
