import type { Metadata } from 'next';

import { TenantActivityScreen } from '@/features/platform/tenant-activity-screen';

export const metadata: Metadata = { title: 'Tenant Activity' };

export default function TenantActivityPage() {
  return <TenantActivityScreen />;
}
