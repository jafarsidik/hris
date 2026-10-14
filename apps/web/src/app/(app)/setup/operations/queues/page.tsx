import type { Metadata } from 'next';

import { QueueMonitorScreen } from '@/features/platform';

export const metadata: Metadata = { title: 'Background jobs' };

export default function QueueMonitorPage() {
  return <QueueMonitorScreen />;
}
