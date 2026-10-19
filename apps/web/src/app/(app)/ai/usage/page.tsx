import type { Metadata } from 'next';

import { UsageCostScreen } from '@/features/ai/usage-cost-screen';

export const metadata: Metadata = { title: 'Usage & Cost' };

export default function UsageCostPage() {
  return <UsageCostScreen />;
}
