import type { Metadata } from 'next';

import { ModulesEntitlementsScreen } from '@/features/platform/modules-entitlements-screen';

export const metadata: Metadata = { title: 'Modules & Entitlements' };

export default function ModulesEntitlementsPage() {
  return <ModulesEntitlementsScreen />;
}
