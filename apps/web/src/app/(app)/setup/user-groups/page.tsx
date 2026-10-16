import type { Metadata } from 'next';

import { UserGroupsScreen } from '@/features/governance/user-groups-screen';

export const metadata: Metadata = { title: 'User Groups' };

export default function UserGroupsPage() {
  return <UserGroupsScreen />;
}
