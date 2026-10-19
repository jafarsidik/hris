import type { Metadata } from 'next';

import { TenantSettingsScreen } from '@/features/platform/tenant-settings-screen';

export const metadata: Metadata = { title: 'Tenant Settings' };

export default function TenantSettingsPage() {
  return <TenantSettingsScreen />;
}
