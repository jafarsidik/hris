import type { Metadata } from 'next';

import { WorkflowInstancesScreen } from '@/features/workflow';

export const metadata: Metadata = { title: 'Execution history' };

export default function WorkflowInstancesPage() {
  return <WorkflowInstancesScreen />;
}
