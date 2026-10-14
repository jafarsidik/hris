import type { Metadata } from 'next';

import { ApprovalAuthorityScreen } from '@/features/platform';

export const metadata: Metadata = { title: 'Approval authority' };

export default function ApprovalAuthorityPage() {
  return <ApprovalAuthorityScreen />;
}
