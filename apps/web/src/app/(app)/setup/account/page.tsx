import type { Metadata } from 'next';

import { AccountScreen } from '@/features/iam/account-screen';

export const metadata: Metadata = { title: 'My Account' };

export default function AccountPage() {
  return <AccountScreen />;
}
