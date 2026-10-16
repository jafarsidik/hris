import type { Metadata } from 'next';

import { DataPoliciesScreen } from '@/features/governance/data-policies-screen';

export const metadata: Metadata = { title: 'Data Policies' };

export default function DataPoliciesPage() {
  return <DataPoliciesScreen />;
}
