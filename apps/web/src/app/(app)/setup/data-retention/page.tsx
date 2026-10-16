import type { Metadata } from 'next';

import { DataRetentionScreen } from '@/features/data-retention';

export const metadata: Metadata = { title: 'Data Retention' };

export default function DataRetentionPage() {
  return <DataRetentionScreen />;
}
