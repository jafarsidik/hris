import type { Metadata } from 'next';

import { AccountSessionsScreen } from '@/features/iam/account-sessions-screen';

export const metadata: Metadata = { title: 'Active Sessions' };

export default function AccountSessionsPage() {
  return <AccountSessionsScreen />;
}
