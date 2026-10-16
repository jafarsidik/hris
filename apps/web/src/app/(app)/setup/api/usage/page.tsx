import type { Metadata } from 'next';

import { UsageScreen } from '@/features/developers/usage-screen';

export const metadata: Metadata = { title: 'API Usage' };

export default function ApiUsagePage() {
  return <UsageScreen />;
}
