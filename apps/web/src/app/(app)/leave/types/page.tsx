import type { Metadata } from 'next';

import { LeaveTypesScreen, getLeaveTypes } from '@/features/leave';

export const metadata: Metadata = { title: 'Leave Types' };

export default async function LeaveTypesPage() {
  const rows = getLeaveTypes();

  return <LeaveTypesScreen rows={rows} />;
}
