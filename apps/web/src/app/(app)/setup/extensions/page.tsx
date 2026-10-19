import type { Metadata } from 'next';

import { ExtensionsScreen } from '@/features/platform/extensions-screen';

export const metadata: Metadata = { title: 'Extension Registry' };

export default function ExtensionsPage() {
  return <ExtensionsScreen />;
}
