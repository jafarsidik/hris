import type { Metadata } from 'next';

import { LeavePoliciesScreen, getLeavePolicies } from '@/features/leave';

export const metadata: Metadata = { title: 'Leave Policies' };

export default async function LeavePoliciesPage() {
  const rows = getLeavePolicies();

  return <LeavePoliciesScreen rows={rows} />;
}
