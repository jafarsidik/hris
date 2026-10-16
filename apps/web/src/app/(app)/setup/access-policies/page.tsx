import type { Metadata } from 'next';

import { AccessPoliciesScreen } from '@/features/governance/access-policies-screen';

export const metadata: Metadata = { title: 'Access Policies' };

export default function AccessPoliciesPage() {
  return <AccessPoliciesScreen />;
}
