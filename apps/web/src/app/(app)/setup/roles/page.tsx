import type { Metadata } from 'next';

import { RolesScreen } from '@/features/iam/roles-screen';

export const metadata: Metadata = { title: 'Roles' };

export default function RolesPage() {
  return <RolesScreen />;
}
