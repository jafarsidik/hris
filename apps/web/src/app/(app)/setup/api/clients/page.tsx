import type { Metadata } from 'next';

import { ClientsScreen } from '@/features/developers/clients-screen';

export const metadata: Metadata = { title: 'API Clients' };

export default function ApiClientsPage() {
  return <ClientsScreen />;
}
