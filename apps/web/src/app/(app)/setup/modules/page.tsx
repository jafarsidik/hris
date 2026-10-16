import type { Metadata } from 'next';

import { ModulesScreen } from '@/features/platform/modules-screen';

export const metadata: Metadata = { title: 'Module Registry' };

export default function ModulesPage() {
  return <ModulesScreen />;
}
