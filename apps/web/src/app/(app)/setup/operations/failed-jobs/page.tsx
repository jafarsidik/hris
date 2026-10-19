import type { Metadata } from 'next';

import { FailedJobsScreen } from '@/features/platform/failed-jobs-screen';

export const metadata: Metadata = { title: 'Failed Jobs' };

export default function FailedJobsPage() {
  return <FailedJobsScreen />;
}
