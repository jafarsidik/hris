import type { Metadata } from 'next';

import { IdentityProvidersScreen } from '@/features/platform';

export const metadata: Metadata = { title: 'Single sign-on' };

export default function IdentityProvidersPage() {
  return <IdentityProvidersScreen />;
}
