import type { Metadata } from 'next';

import { ConfigurationSchemasScreen } from '@/features/platform/configuration-schemas-screen';

export const metadata: Metadata = { title: 'Configuration Schemas' };

export default function ConfigurationSchemasPage() {
  return <ConfigurationSchemasScreen />;
}
