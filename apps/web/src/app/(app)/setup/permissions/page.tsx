import type { Metadata } from 'next';

import { PermissionsScreen } from '@/features/iam/permissions-screen';

export const metadata: Metadata = { title: 'Permissions' };

export default function PermissionsPage() {
  return <PermissionsScreen />;
}
