import type { Metadata } from 'next';

import { CredentialsScreen } from '@/features/developers/credentials-screen';

export const metadata: Metadata = { title: 'API Credentials' };

export default function ApiCredentialsPage() {
  return <CredentialsScreen />;
}
