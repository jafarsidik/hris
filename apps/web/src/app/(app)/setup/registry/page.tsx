import type { Metadata } from 'next';

import { ResourceRegistryScreen } from '@/features/platform';

export const metadata: Metadata = { title: 'Resource registry' };

export default function ResourceRegistryPage() {
  return <ResourceRegistryScreen />;
}
