import type { Metadata } from 'next';

import { OrganizationScreen } from '@/features/organization/organization-screen';

export const metadata: Metadata = { title: 'Organizations' };

export default function OrganizationPage() {
  return <OrganizationScreen />;
}
