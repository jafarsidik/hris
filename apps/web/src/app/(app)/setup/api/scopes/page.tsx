import type { Metadata } from 'next';

import { ScopesScreen } from '@/features/developers/scopes-screen';

export const metadata: Metadata = { title: 'API Scopes' };

export default function ApiScopesPage() {
  return <ScopesScreen />;
}
