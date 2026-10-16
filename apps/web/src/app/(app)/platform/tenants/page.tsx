import type { Metadata } from 'next';

import { TenantsScreen } from '@/features/tenants';

export const metadata: Metadata = { title: 'Tenant Management' };

export default function TenantsPage() {
  return <TenantsScreen />;
}
