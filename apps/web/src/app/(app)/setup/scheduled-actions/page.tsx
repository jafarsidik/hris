import type { Metadata } from 'next';

import { ScheduledActionsScreen } from '@/features/automation';

export const metadata: Metadata = { title: 'Scheduled Actions' };

export default function ScheduledActionsPage() {
  return <ScheduledActionsScreen />;
}
