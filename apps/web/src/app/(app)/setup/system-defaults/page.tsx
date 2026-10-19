import type { Metadata } from 'next';

import { SystemDefaultsScreen } from '@/features/iam/system-defaults-screen';

export const metadata: Metadata = { title: 'System Defaults' };

export default function SystemDefaultsPage() {
  return <SystemDefaultsScreen />;
}
