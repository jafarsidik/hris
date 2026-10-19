import type { Metadata } from 'next';

import { LeaveRequestsScreen } from '@/features/leave';
import { getLeaveRepository } from '@/features/leave';

/**
 * The server page fetches the first page of leave requests and hands them to
 * the client screen. Every interaction after first paint — filtering, status
 * changes — belongs to the screen or to server actions.
 */
export const metadata: Metadata = { title: 'Leave Requests' };

export default async function LeaveRequestsPage() {
  const repository = getLeaveRepository();
  const page = await repository.listRequests({});

  return <LeaveRequestsScreen initialRows={page.items} />;
}
