import type { Metadata } from 'next';

import { UsageQuotasScreen } from '@/features/platform/usage-quotas-screen';

export const metadata: Metadata = { title: 'Usage & Quotas' };

export default function UsageQuotasPage() {
  return <UsageQuotasScreen />;
}
