import type { Metadata } from 'next';

import { ApprovalsScreen } from '@/features/workflow';

export const metadata: Metadata = { title: 'My approvals' };

export default function ApprovalsPage() {
  return <ApprovalsScreen />;
}
