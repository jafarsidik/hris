import type { Metadata } from 'next';

import { AccountSecurityScreen } from '@/features/platform';

export const metadata: Metadata = { title: 'Sign-in security' };

export default function AccountSecurityPage() {
  return <AccountSecurityScreen />;
}
