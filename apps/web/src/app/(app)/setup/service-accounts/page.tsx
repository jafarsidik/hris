import type { Metadata } from 'next';

import { ServiceAccountsScreen } from '@/features/governance/service-accounts-screen';

export const metadata: Metadata = { title: 'Service Accounts' };

export default function ServiceAccountsPage() {
  return <ServiceAccountsScreen />;
}
